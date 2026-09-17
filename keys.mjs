// Secrets live one per file in ~/.config/daylines/keys, each mode 600, so tokens
// stay out of the config file and out of your shell history.
//
// Save one with `daylines key <name>`, then reference it anywhere in a source as
// {key:name}:
//
//   { "label": "Sales", "url": "https://api.example.com/today",
//     "headers": { "Authorization": "Bearer {key:example}" }, "pick": "total" }
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { configDir } from "./config.mjs";

const NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export function keysDir() {
  return join(configDir(), "keys");
}

function keyPath(name) {
  if (!NAME.test(name)) throw new Error(`"${name}" is not a valid key name (letters, digits, dash, underscore)`);
  return join(keysDir(), name);
}

/** An older layout kept the Plausible key in its own file next to the config. */
function migrateLegacy() {
  const old = join(configDir(), "plausible.key");
  if (!existsSync(old) || existsSync(join(keysDir(), "plausible"))) return;
  mkdirSync(keysDir(), { recursive: true, mode: 0o700 });
  renameSync(old, join(keysDir(), "plausible"));
  chmodSync(join(keysDir(), "plausible"), 0o600);
}

export function saveKey(name, value) {
  mkdirSync(keysDir(), { recursive: true, mode: 0o700 });
  writeFileSync(keyPath(name), value.trim() + "\n", { mode: 0o600 });
  return keyPath(name);
}

export function readKey(name) {
  migrateLegacy();
  const path = keyPath(name);
  return existsSync(path) ? readFileSync(path, "utf8").trim() : "";
}

export function listKeys() {
  migrateLegacy();
  try {
    return readdirSync(keysDir()).filter((n) => NAME.test(n)).sort();
  } catch {
    return [];
  }
}

/**
 * Replace every {key:name} in a string with the saved secret. Missing keys throw,
 * so a source says what is missing instead of quietly sending an empty token.
 */
export function expandKeys(text) {
  return String(text).replace(/\{key:([a-zA-Z0-9][a-zA-Z0-9_-]{0,63})\}/g, (_, name) => {
    const value = readKey(name);
    if (!value) throw new Error(`no key named "${name}", save one with: daylines key ${name}`);
    return value;
  });
}

/** Same, through a whole source: strings are expanded, the shape is kept. */
export function expandSource(source) {
  const walk = (value) => {
    if (typeof value === "string") return expandKeys(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
    return value;
  };
  return walk(source);
}
