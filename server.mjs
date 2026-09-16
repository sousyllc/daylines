// Serves the calendar at /feed.ics?key=<token> on 127.0.0.1.
import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { loadConfig } from "./config.mjs";
import { ics } from "./feed.mjs";
import { readAll } from "./sources.mjs";

// Older site-stats installs subscribed to this path, so it still works.
const PATHS = new Set(["/feed.ics", "/api/stats.ics"]);

export class Feed {
  constructor(cfg, log = () => {}) {
    this.cfg = cfg;
    this.log = log;
    this.lines = [];
    this.updatedAt = 0;
    this.timer = null;
  }

  async refresh() {
    this.lines = await readAll(this.cfg.sources);
    this.updatedAt = Date.now();
    const bad = this.lines.filter((l) => /^[^:]+: /.test(l) && !/·/.test(l));
    if (bad.length) this.log(bad.join("; "));
    return this.lines;
  }

  start() {
    this.refresh().catch((err) => this.log(String(err.message || err)));
    this.timer = setInterval(() => this.refresh().catch(() => {}), Math.max(1, this.cfg.refreshMinutes) * 60_000);
    this.timer.unref?.();
    return this;
  }

  stop() {
    clearInterval(this.timer);
  }

  ics() {
    return ics({ lines: this.lines, name: this.cfg.calendarName, updatedAt: this.updatedAt || Date.now() });
  }
}

export function startServer() {
  const cfg = loadConfig();
  const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
  const feed = new Feed(cfg, log).start();
  const want = Buffer.from(cfg.token);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/health") return res.end("ok\n");
    if (req.method !== "GET" || !PATHS.has(url.pathname)) {
      res.writeHead(404);
      return res.end();
    }
    const key = Buffer.from(url.searchParams.get("key") || "");
    if (key.length !== want.length || !timingSafeEqual(key, want)) {
      res.writeHead(401);
      return res.end("bad key\n");
    }
    if (Date.now() - feed.updatedAt > 5 * 60_000) await feed.refresh().catch(() => {});
    res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" });
    res.end(feed.ics());
  });
  server.listen(cfg.port, "127.0.0.1", () => log(`daylines on http://127.0.0.1:${cfg.port}, ${cfg.sources.length} sources`));
  return { server, feed };
}
