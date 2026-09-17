// Plausible source: today's unique visitors for a site, optionally narrowed by goals.
//
//   { "label": "Shop", "type": "plausible", "site": "example.com",
//     "visitors":  { "goal": ["Homepage visited"] },
//     "appStore":  { "goal": ["App Store Badge Clicked", "app_store_clicked"] },
//     "playStore": { "goal": ["Google Play Badge Clicked", "play_store_clicked"] } }
//
// The Stats API matches goals by their display name, so list the display name first
// and the raw event name after it as a fallback.
import { readKey } from "./keys.mjs";
import { fill } from "./sources.mjs";

export function today(d = new Date()) {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD in this machine's timezone
}

export class Plausible {
  constructor({ server = "https://plausible.io" } = {}) {
    this.server = server.replace(/\/$/, "");
  }

  get key() {
    return readKey("plausible");
  }

  async query(body) {
    const res = await fetch(`${this.server}/api/v2/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Plausible ${res.status}`);
    return data.results?.[0]?.metrics?.[0] ?? 0;
  }

  async count(site, date, spec) {
    const goals = spec.goal ? [].concat(spec.goal) : [null];
    for (const goal of goals) {
      const filters = [...(goal ? [["is", "event:goal", [goal]]] : []), ...(spec.filters || [])];
      try {
        return await this.query({ site_id: site, metrics: ["visitors"], date_range: [date, date], filters });
      } catch (err) {
        if (!/not configured/i.test(err.message)) throw err; // only fall through on a goal-name miss
      }
    }
    throw new Error(`no goal named ${goals.map((g) => `"${g}"`).join(" or ")} on ${site}`);
  }

  /** One line for the source, e.g. "Shop 120 visits · 4 App Store · 2 Play". */
  async lines(source) {
    if (!this.key) throw new Error("no API key, run: daylines key plausible");
    const date = today();
    const parts = {};
    const errors = [];
    for (const field of ["visitors", "appStore", "playStore"]) {
      if (!source[field]) continue;
      try {
        parts[field] = await this.count(source.site, date, source[field]);
      } catch (err) {
        parts[field] = null;
        errors.push(err.message);
      }
    }
    const bits = [];
    if (source.visitors) bits.push(`{visits} visits`);
    if (source.appStore) bits.push(`{appStore} App Store`);
    if (source.playStore) bits.push(`{playStore} Play`);
    const format = source.format || `{label} ${bits.join(" · ")}`.trim();
    const line = fill(format, { ...source, visits: parts.visitors, ...parts });
    return [errors.length && !bits.length ? `${source.label}: ${errors[0]}` : line];
  }
}
