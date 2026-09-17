// A source is anything that can produce a line of text for the calendar.
//
//   { "label": "CI",    "command": "gh run list -L1 --json conclusion -q .[0].conclusion" }
//   { "label": "npm",   "url": "https://api.npmjs.org/downloads/point/last-day/@sousy/glancecode", "pick": "downloads" }
//   { "label": "Shop",  "type": "plausible", "site": "example.com", "visitors": {} }
//
// Every source produces one or more lines, and each line becomes an all-day event.
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { expandSource } from "./keys.mjs";
import { Plausible } from "./plausible.mjs";

const run = promisify(exec);

/** "data.items.0.count" out of a parsed JSON body. */
export function pick(value, path) {
  if (!path) return value;
  for (const key of String(path).split(".")) {
    if (value == null) return undefined;
    value = value[key];
  }
  return value;
}

/** "{label} {value} visits" with the source's own fields available too. */
export function fill(template, fields) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (fields[key] === undefined || fields[key] === null ? "?" : String(fields[key])));
}

async function fromCommand(source) {
  const { stdout } = await run(source.command, { timeout: (source.timeoutSeconds || 20) * 1000, maxBuffer: 1 << 20, shell: process.env.SHELL || "/bin/sh" });
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, source.maxLines || 3);
  if (!lines.length) return [];
  const format = source.format || (source.label ? "{label} {value}" : "{value}");
  return lines.map((value) => fill(format, { ...source, value }));
}

async function fromUrl(source) {
  const res = await fetch(source.url, { headers: source.headers || {}, signal: AbortSignal.timeout((source.timeoutSeconds || 15) * 1000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 80)}`);
  let value = text.trim();
  if (source.pick !== undefined) {
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("response is not JSON");
    }
    value = pick(body, source.pick);
    if (value === undefined) throw new Error(`no "${source.pick}" in the response`);
  }
  if (typeof value === "number" && source.round !== false) value = Math.round(value * 100) / 100;
  const format = source.format || (source.label ? "{label} {value}" : "{value}");
  return [fill(format, { ...source, value })];
}

/**
 * Read one source. Never throws: a broken source shows its own error on the
 * calendar, so a failing command can't empty the whole feed.
 */
export async function readSource(raw) {
  let source = raw;
  try {
    source = expandSource(raw); // {key:name} becomes the saved secret
    if (source.type === "plausible" || (!source.command && !source.url && source.site)) return await new Plausible().lines(source);
    if (source.command) return await fromCommand(source);
    if (source.url) return await fromUrl(source);
    return [`${source.label || "source"}: needs command, url or site`];
  } catch (err) {
    const why = String(err.message || err).split("\n")[0].slice(0, 90);
    return [`${source.label || "source"}: ${why}`];
  }
}

export async function readAll(sources) {
  const lists = await Promise.all(sources.map((s) => readSource(s)));
  return lists.flat();
}
