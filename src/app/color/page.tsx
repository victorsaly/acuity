"use client";

import { useEffect, useRef, useState } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import ShareScore from "@/components/ShareScore";
import Celebrate from "@/components/Celebrate";
import { Stagger, Item, Pop } from "@/components/Fx";
import { getBest, setBest, scoreKey, rngFor, usePref, todayStamp, recordPlay, type Mode } from "@/lib/store";
import { scoreCard, slotEmoji } from "@/lib/share";
import { uiBlip } from "@/lib/audio";

type HSL = { h: number; s: number; l: number };
type Phase = "menu" | "reveal" | "recall" | "results";

const SLOTS = 5;
const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "5s each", note: 523 },
  { key: "hard", label: "Hard", sub: "2s each", note: 659 },
  { key: "brutal", label: "Brutal", sub: "1s each", note: 784 },
];
const REVEAL_MS: Record<string, number> = { easy: 5000, hard: 2000, brutal: 1000 };
const FLOWS = [
  { key: "single", label: "One at a time" },
  { key: "batch", label: "All five first" },
];

/* ---------- color math ---------- */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (v: number) => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const deltaE = (a: HSL, b: HSL) => {
  const la = rgbToLab(hslToRgb(a.h, a.s, a.l));
  const lb = rgbToLab(hslToRgb(b.h, b.s, b.l));
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
};
const css = (c: HSL) => `hsl(${c.h} ${c.s}% ${c.l}%)`;
const isLight = (c: HSL) => rgbToLab(hslToRgb(c.h, c.s, c.l))[0] > 60;
const scoreOf = (t: HSL, g: HSL) => Math.max(0, 10 * (1 - deltaE(t, g) / 55));

const RING_C = 2 * Math.PI * 25;

/* "how far off" hint: signed hue (shortest way round), saturation, lightness */
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
const deltaLabel = (t: HSL, g: HSL) => {
  const dh = ((g.h - t.h + 540) % 360) - 180;
  return `H ${signed(dh)}° · S ${signed(g.s - t.s)} · L ${signed(g.l - t.l)}`;
};

export default function ColorGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = usePref("color-diff", "easy");
  const [modeStr, setMode] = usePref("color-mode", "free");
  const mode = modeStr as Mode;
  const [flow, setFlow] = usePref("color-flow", "single");
  const [slot, setSlot] = useState(0);
  const [targets, setTargets] = useState<HSL[]>([]);
  const [guesses, setGuesses] = useState<HSL[]>([]);
  const [guess, setGuess] = useState<HSL>({ h: 180, s: 50, l: 50 });
  const [revealColor, setRevealColor] = useState<HSL | null>(null);
  const [runStamp, setRunStamp] = useState(0);
  const [record, setRecord] = useState(false);

  const timers = useRef<number[]>([]);
  const ringRef = useRef<SVGCircleElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const countdown = useRef({ deadline: 0, total: 1, nextTick: 0 });
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  function revealSlot(i: number, cols: HSL[], ms: number) {
    setSlot(i);
    setRevealColor(cols[i]);
    countdown.current = { deadline: performance.now() + ms, total: ms, nextTick: performance.now() + 200 };
    /* the ring may be (re)mounting this frame — look it up after commit */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const ring = ringRef.current;
      if (!ring) return;
      ring.style.transition = "none";
      ring.style.strokeDashoffset = "0";
      requestAnimationFrame(() => {
        ring.style.transition = `stroke-dashoffset ${ms}ms linear`;
        ring.style.strokeDashoffset = String(RING_C);
      });
    }));
    later(() => {
      setRevealColor(null); // dark gap so consecutive colors don't blend
      later(() => {
        if (flow === "single") { setGuess({ h: 180, s: 50, l: 50 }); setPhase("recall"); }
        else if (i + 1 < SLOTS) revealSlot(i + 1, cols, ms);
        else { setSlot(0); setGuess({ h: 180, s: 50, l: 50 }); setPhase("recall"); }
      }, 220);
    }, ms);
  }

  const start = () => {
    clear();
    const rng = rngFor(mode, "color", diff);
    const cols: HSL[] = Array.from({ length: SLOTS }, () => ({
      h: Math.floor(rng() * 360),
      s: 35 + Math.floor(rng() * 60),
      l: 25 + Math.floor(rng() * 50),
    }));
    setTargets(cols);
    setGuesses([]);
    setPhase("reveal");
    revealSlot(0, cols, REVEAL_MS[diff]);
  };

  const lock = () => {
    const next = [...guesses, guess];
    setGuesses(next);
    if (next.length < SLOTS) {
      setSlot(next.length);
      setGuess({ h: 180, s: 50, l: 50 });
      if (flow === "single") { setPhase("reveal"); revealSlot(next.length, targets, REVEAL_MS[diff]); }
    } else {
      const total = targets.reduce((sum, t, i) => sum + scoreOf(t, next[i]), 0);
      const key = scoreKey("color", mode, diff);
      const isRecord = total > getBest(key) && total > 0;
      if (isRecord) setBest(key, Math.round(total * 10) / 10);
      setRecord(isRecord);
      recordPlay("color");
      setRunStamp(Date.now());
      setPhase("results");
    }
  };

  /* racing countdown while memorizing: hundredths on every frame, the
     digits swell, and the ticks come faster and higher as time runs out */
  useEffect(() => {
    if (phase !== "reveal") return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const cd = countdown.current;
      const now = performance.now();
      const rem = Math.max(0, cd.deadline - now);
      const progress = 1 - rem / cd.total;
      const el = countRef.current;
      if (el) {
        el.textContent = (rem / 1000).toFixed(2);
        el.style.transform = `scale(${1 + progress * 0.5})`;
      }
      if (rem > 0 && now >= cd.nextTick) {
        uiBlip(360 + progress * 800, 0.04 + progress * 0.03, 0.06);
        cd.nextTick = now + 70 + 560 * Math.pow(1 - progress, 1.6);   // 630ms apart → 70ms
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && phase === "recall") lock();
      if (e.key === "Escape" && phase !== "menu" && !document.fullscreenElement) { clear(); setPhase("menu"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  /* ---------- render ---------- */
  if (phase === "menu") {
    return (
      <main className="stage">
        <Stagger style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <Item><h1 className="wordmark">Afterimage</h1></Item>
          <Item>
            <div className="swatches" aria-hidden>
              {[0, 60, 150, 210, 290].map((h, i) => (
                <span key={h} className="swatch"
                  style={{ background: `hsl(${h} 80% 58%)`, animationDelay: `${i * -1.2}s` }} />
              ))}
            </div>
          </Item>
          <Item><p className="tagline">Five colors flood the screen. Then they&apos;re gone, and you rebuild every one from memory.</p></Item>
          <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <GameSetup game="color" diffs={DIFFS} diff={diff} mode={mode}
              onDiff={setDiff} onMode={setMode} onStart={start} refreshToken={runStamp}
              formats={FLOWS} format={flow} onFormat={setFlow} />
          </Item>
        </Stagger>
      </main>
    );
  }

  if (phase === "reveal") {
    const c = revealColor;
    return (
      <main className={`stage ${c && isLight(c) ? "onLight" : "onDark"}`}
        style={{ backgroundColor: c ? css(c) : "var(--ink)", transition: "background-color .16s" }}>
        <div className="slotTag" style={{ opacity: 0.85 }}>Memorize</div>
        <div className="slotNum">{c ? slot + 1 : ""}</div>
        <div className="ringwrap" aria-hidden>
          <svg viewBox="0 0 56 56">
            <circle className="ringBg" cx="28" cy="28" r="25" />
            <circle className="ringFg" ref={ringRef} cx="28" cy="28" r="25"
              style={{ strokeDasharray: RING_C }} />
          </svg>
        </div>
        <div className="countNum" ref={countRef} style={{ opacity: c ? 0.9 : 0 }} aria-live="off" />
      </main>
    );
  }

  if (phase === "recall") {
    const grad = (prop: "s" | "l") =>
      prop === "s"
        ? `linear-gradient(90deg, hsl(${guess.h} 0% ${guess.l}%), hsl(${guess.h} 100% ${guess.l}%))`
        : `linear-gradient(90deg, #000, hsl(${guess.h} ${guess.s}% 50%), #fff)`;
    const hueGrad = `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, i) => `hsl(${i * 30} ${guess.s}% ${guess.l}%)`).join(",")})`;
    return (
      <main className="stage recallStage" style={{ backgroundColor: css(guess), transition: "background-color .08s linear" }}>
        <div className={`recallHead ${isLight(guess) ? "onLight" : "onDark"}`}>
          Rebuild color {guesses.length + 1} of {SLOTS}
          {guesses.length > 0 && ` · ${guesses.reduce((s, g, i) => s + scoreOf(targets[i], g), 0).toFixed(1)} pts so far`}
        </div>
        <div className="mixer">
          {(["h", "s", "l"] as const).map((k) => (
            <div className="srow" key={k}>
              <label htmlFor={k}>{k.toUpperCase()}</label>
              <input id={k} type="range" min={0} max={k === "h" ? 360 : 100} step={1}
                value={guess[k]}
                style={{ background: k === "h" ? hueGrad : grad(k) }}
                onChange={(e) => setGuess({ ...guess, [k]: +e.target.value })}
                aria-label={{ h: "Hue", s: "Saturation", l: "Lightness" }[k]} />
              <output>{guess[k]}</output>
            </div>
          ))}
          <button className="lock" data-note={440} onClick={lock}>Lock it in</button>
          <div className="kbd" style={{ marginTop: 12 }}>
            <span><b>←→</b>adjust</span><span><b>Tab</b>next slider</span><span><b>↵</b>lock</span><span><b>Esc</b>menu</span>
          </div>
        </div>
      </main>
    );
  }

  /* results */
  const scores = targets.map((t, i) => scoreOf(t, guesses[i]));
  const total = scores.reduce((a, b) => a + b, 0);
  const best = getBest(scoreKey("color", mode, diff));
  const verdict =
    total >= 45 ? "Dialed in." :
    total >= 38 ? "Sharp eye." :
    total >= 28 ? "Getting warm." :
    total >= 18 ? "A bit fuzzy." : "Colors are hard.";

  return (
    <main className="stage resStage">
      {record && <Celebrate />}
      <Pop className="resHead">
        <h2 className="resVerdict">{verdict}</h2>
        <div className="resTotal">
          <b>{total.toFixed(1)} / 50</b> · {mode} · {diff}
          {best > 0 && ` · best ${best.toFixed(1)}`}
        </div>
      </Pop>
      <Stagger className="colorPanels">
        {targets.map((t, i) => (
          <Item className="colorPanel" key={i}>
            <div className="half" style={{ background: css(t) }} />
            <div className="half" style={{ background: css(guesses[i]) }} />
            <div className="panelTags">
              <span className={isLight(t) ? "onLight" : "onDark"}>target</span>
              <span className={isLight(guesses[i]) ? "onLight" : "onDark"}>you</span>
            </div>
            <div className="chip">
              {scores[i].toFixed(2)}
              <small>{deltaLabel(t, guesses[i])}</small>
            </div>
          </Item>
        ))}
      </Stagger>
      <div className="resActions">
        <button className="cta" data-note={440} onClick={start}>Play again</button>
        <ShareScore text={scoreCard(
          "Afterimage",
          `${diff}${mode === "daily" ? ` · daily ${todayStamp()}` : ""}`,
          `${total.toFixed(1)}/50 ${scores.map(slotEmoji).join("")}`,
        )} />
        <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Options</button>
      </div>
    </main>
  );
}
