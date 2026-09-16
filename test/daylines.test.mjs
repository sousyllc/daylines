import assert from "node:assert/strict";
import { test } from "node:test";
import { foldLine, ics } from "../feed.mjs";
import { fill, pick, readSource } from "../sources.mjs";

test("a command source becomes one line per output line", async () => {
  const lines = await readSource({ label: "Build", command: "printf 'passing\\n'" });
  assert.deepEqual(lines, ["Build passing"]);
});

test("a command source respects its own format and line limit", async () => {
  const lines = await readSource({ label: "Todo", command: "printf 'a\\nb\\nc\\nd\\n'", maxLines: 2, format: "{label}: {value}" });
  assert.deepEqual(lines, ["Todo: a", "Todo: b"]);
});

test("a failing source reports itself instead of emptying the feed", async () => {
  const lines = await readSource({ label: "CI", command: "exit 3" });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^CI: /);
});

test("pick walks a path and fill substitutes fields", () => {
  assert.equal(pick({ a: { b: [{ c: 7 }] } }, "a.b.0.c"), 7);
  assert.equal(pick({ a: 1 }, "nope.deep"), undefined);
  assert.equal(fill("{label} {value} left", { label: "Disk", value: 12 }), "Disk 12 left");
  assert.equal(fill("{label} {value}", { label: "X", value: null }), "X ?");
});

test("the calendar has one folded, escaped, all-day event per line", () => {
  const out = ics({ lines: ["Shop 120 visits · 4 App Store", "CI passing"], name: "Daylines", updatedAt: Date.parse("2026-09-16T20:30:00Z"), now: new Date("2026-09-16T20:31:00Z") });
  assert.equal((out.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(out, /SUMMARY:Shop 120 visits · 4 App Store\r\n/);
  assert.match(out, /DTSTART;VALUE=DATE:\d{8}\r\nDTEND;VALUE=DATE:\d{8}\r\n/);
  assert.match(out, /UID:daylines-shop-\d{4}-\d{2}-\d{2}@daylines/);
  assert.match(out, /X-WR-CALNAME:Daylines/);
  for (const line of out.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, `line too long: ${line}`);
});

test("two lines that start alike keep separate events", () => {
  const out = ics({ lines: ["Sousy 4 visits", "Sousy 9 signups"], now: new Date("2026-09-16T20:31:00Z") });
  const uids = out.match(/UID:[^\r]+/g);
  assert.equal(new Set(uids).size, 2);
});

test("long lines fold and unfold to the original", () => {
  assert.equal(foldLine("x".repeat(80)).split("\r\n ").join(""), "x".repeat(80));
});
