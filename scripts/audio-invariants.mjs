/**
 * Audio invariants for the rhythm games.
 *
 * These games can break in a way that neither TypeScript nor eslint can see:
 * the code runs fine, but the game stops being the game. Phantom Drop once
 * played the drop it was asking you to predict, and Fever Dream ran a click
 * track underneath the bars you were supposed to carry alone — in both cases
 * a single extra line in a scheduling loop silently turned a listening test
 * into a reaction test.
 *
 * So we assert on the audio itself. Every scheduled onset is recorded by
 * patching AudioBufferSourceNode/OscillatorNode.start, and taps are dispatched
 * off ctx.currentTime rather than wall-clock time, because wall-clock timers
 * drift far more than the scoring windows we are measuring.
 *
 * Usage: npm run dev, then `npm run test:audio` (needs Chrome installed).
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const INIT = `
  window.__sched = [];
  const AC = window.AudioContext;
  window.AudioContext = class extends AC {
    constructor(...a) { super(...a); window.__ctx = this; }
  };
  for (const K of [AudioBufferSourceNode, OscillatorNode]) {
    const orig = K.prototype.start;
    K.prototype.start = function (when, ...rest) {
      window.__sched.push(when ?? (window.__ctx ? window.__ctx.currentTime : 0));
      return orig.call(this, when, ...rest);
    };
  }
  /* A player who is dead on the beat acts on what they HEAR, so a perfect tap
     lands one output-latency after the scheduled time. */
  window.__tapAt = (times, sel) => new Promise((done) => {
    const c = window.__ctx, lat = c.outputLatency || c.baseLatency || 0, q = times.slice();
    const step = () => {
      while (q.length && c.currentTime >= q[0] + lat) {
        q.shift();
        document.querySelector(sel)?.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
      }
      if (!q.length) return done(true);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
`;

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext();
await context.addInitScript(INIT);
const page = await context.newPage();

const clear = () => page.evaluate(() => { window.__sched.length = 0; });

/**
 * One drum hit is several sources: a clap is two noise bursts 28ms apart, and
 * kick/hat/bass stack on the same beat. Group anything inside `tol` into the
 * hit it belongs to and keep the earliest onset — that is the moment a
 * listener perceives. `tol` must stay under the smallest nudge under test.
 */
const cluster = (times, tol) =>
  times.reduce((acc, t) => (acc.length && t - acc[acc.length - 1] < tol ? acc : [...acc, t]), []);

/** Hits after the Start button's UI blip (~0.65s before the count-in). */
async function onsets(tol = 0.035) {
  const raw = await page.evaluate(() => window.__sched.slice().sort((a, b) => a - b));
  const hits = cluster(raw, tol);
  const gap = hits.findIndex((w, i) => i > 0 && w - hits[i - 1] > 0.4);
  return gap > 0 ? hits.slice(gap) : hits;
}
async function open(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  if (await page.locator('[role="dialog"]').isVisible().catch(() => false)) {
    const box = await page.locator(".soundGateBtn").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
  }
  await clear();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForTimeout(300);
}

/* ---------------- Phantom Drop ---------------- */
{
  await open("/phantom");
  const s = await onsets();
  const g0 = s[0], beat = 60 / 100;                       // easy
  const silence = g0 + 8 * beat, target = g0 + 12 * beat, dead = target + 2 * beat;
  const inside = s.filter((w) => w > silence + 0.01 && w <= dead + 0.01);
  check("phantom: groove is 8 beats", Math.abs(s[s.length - 1] - g0 - 7 * beat) < 0.05,
    `last onset ${(s[s.length - 1] - g0).toFixed(2)}s`);
  check("phantom: NOTHING sounds in the answer window", inside.length === 0,
    `${inside.length} onsets in ${(silence - g0).toFixed(2)}..${(dead - g0).toFixed(2)}s`);
  await page.evaluate(([t]) => window.__tapAt([t], "main button"), [target]);
  await page.waitForTimeout(400);
  const text = await page.locator("main").innerText();
  const ms = Number((text.match(/(\d+)ms/) ?? [])[1] ?? 9999);
  check("phantom: a tap on the phantom 1 scores near-perfect", ms <= 25, `${ms}ms error`);
}

/* ---------------- Fever Dream ---------------- */
{
  await open("/fever");
  const s = await onsets();
  const f0 = s[0], beat = 60 / 92;                        // easy
  const playStart = f0 + 9 * beat;
  const after = s.filter((w) => w >= playStart - 0.01);
  check("fever: count-in is 8 beats plus the two-tone alarm",
    Math.abs(s[s.length - 2] - f0 - 8 * beat) < 0.05, `alarm at ${(s[s.length - 2] - f0).toFixed(2)}s`);
  check("fever: NOTHING sounds once the tapping starts", after.length === 0,
    `${after.length} onsets at/after ${(playStart - f0).toFixed(2)}s`);
  const slots = Array.from({ length: 8 }, (_, i) => playStart + i * beat);
  await page.evaluate(([s]) => window.__tapAt(s, "main"), [slots]);
  await page.waitForTimeout(1500);
  const text = await page.locator("main").innerText();
  const score = Number((text.match(/([\d.]+)\s*\/\s*80/) ?? [])[1] ?? 0);
  check("fever: eight taps on the silent pulse score near-max", score >= 70, `${score}/80`);
}

/* ---------------- Off-Grid ---------------- */
{
  await open("/offgrid");
  const s = await onsets();
  const g0 = s[0], step = 60 / 96 / 2;                    // easy, eighth notes
  // Round 1 nudges exactly one of the 8 steps by 85ms; the rest sit on the grid.
  const pass = s.slice(0, 8).map((w, i) => Math.round(((w - g0) - i * step) * 1000));
  const nudged = pass.filter((d) => Math.abs(d) > 5);
  check("offgrid: exactly one step is off the grid", nudged.length === 1,
    `step offsets ${pass.join(",")}ms`);
  check("offgrid: the nudge is the configured 85ms",
    nudged.length === 1 && Math.abs(nudged[0] - 85) < 6, `${nudged[0] ?? "none"}ms`);
  check("offgrid: the anchor step is never the culprit", pass[0] === 0 && pass[1] === 0,
    `steps 0,1 at ${pass[0]},${pass[1]}ms`);
  /* No assertion on lamp timing. The lamps are cues on the same clock as the
     audio by construction, but observing them from outside costs a rAF plus a
     React commit plus output latency — ~40ms of noise around a nudge that is
     14ms at the top difficulty. A test that cannot resolve the bug it guards
     is worse than no test, so the honest invariant is the audio above. */
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} invariants held`);
process.exit(failed.length ? 1 : 0);
