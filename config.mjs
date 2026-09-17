// Settings live in ~/.config/daylines/config.json (mode 600).
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Read at call time, so tests can point XDG_CONFIG_HOME somewhere temporary. */
export function configDir() {
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "daylines");
}

export const CONFIG_DIR = configDir();
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const LEGACY_DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "site-stats");

export const DEFAULTS = {
  // Feed server on 127.0.0.1. Phones reach it through tailscale serve.
  port: 7720,
  // Name the phone shows for the subscribed calendar.
  calendarName: "Daylines",
  // How often sources are re-read.
  refreshMinutes: 10,
  // What to put on the calendar. See README.
  sources: [],
};

/** Move an older site-stats setup over, keeping its feed token so the calendar URL still works. */
function migrateLegacy() {
  if (existsSync(CONFIG_FILE) || !existsSync(join(LEGACY_DIR, "config.json"))) return;
  mkdirSync(CONFIG_DIR, { recursive: true });
  const old = JSON.parse(readFileSync(join(LEGACY_DIR, "config.json"), "utf8"));
  const cfg = {
    port: old.port ?? DEFAULTS.port,
    calendarName: "Site stats",
    token: old.token,
    sources: (old.products || []).map((p) => ({ ...p, type: "plausible" })),
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  for (const file of ["plausible.key"]) {
    if (existsSync(join(LEGACY_DIR, file)) && !existsSync(join(CONFIG_DIR, file))) copyFileSync(join(LEGACY_DIR, file), join(CONFIG_DIR, file));
  }
}

export function loadConfig() {
  mkdirSync(CONFIG_DIR, { recursive: true });
  migrateLegacy();
  let cfg = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      cfg = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    } catch (err) {
      throw new Error(`could not parse ${CONFIG_FILE}: ${err.message}`);
    }
  }
  // Read-only token for the feed URL, because phones store subscribed calendar URLs.
  if (!cfg.token) {
    cfg.token = randomBytes(18).toString("base64url");
    writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  }
  return { ...DEFAULTS, ...cfg };
}
