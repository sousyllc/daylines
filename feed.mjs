// Lines in, calendar out: one all-day event per line, for today.
import { today } from "./plausible.mjs";

/** RFC 5545 lines are at most 75 octets; continue with CRLF + space. */
export function foldLine(line) {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const parts = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const esc = (t) => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "line";

/**
 * All-day events keep the phone's Calendar widget showing them all day, and stable
 * UIDs mean a refresh replaces yesterday's numbers instead of piling up.
 */
export function ics({ lines, name = "Daylines", updatedAt = Date.now(), now = new Date() }) {
  const day = (d) => today(d).replace(/-/g, "");
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const updated = new Date(updatedAt);
  const label = `Updated ${updated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  const seen = new Map();
  const out = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//daylines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];
  for (const line of lines) {
    // The first word or two of the line identifies it across refreshes.
    let key = slug(line.split(/\s+\d|\s+·/)[0]);
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (count > 1) key += `-${count}`;
    out.push(
      "BEGIN:VEVENT",
      `UID:daylines-${key}-${today(now)}@daylines`,
      `DTSTAMP:${stamp(now)}`,
      `LAST-MODIFIED:${stamp(updated)}`,
      `SEQUENCE:${Math.floor(updated.getTime() / 60_000)}`,
      `DTSTART;VALUE=DATE:${day(now)}`,
      `DTEND;VALUE=DATE:${day(tomorrow)}`,
      `SUMMARY:${esc(line)}`,
      `DESCRIPTION:${esc(label)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  out.push("END:VCALENDAR");
  return out.map(foldLine).join("\r\n") + "\r\n";
}
