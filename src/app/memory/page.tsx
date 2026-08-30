"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import ShareScore from "@/components/ShareScore";
import Celebrate from "@/components/Celebrate";
import { Stagger, Item, Pop } from "@/components/Fx";
import { getBest, setBest, scoreKey, rngFor, usePref, todayStamp, recordPlay, type Mode } from "@/lib/store";
import { scoreCard } from "@/lib/share";
import { uiBlip, buzz } from "@/lib/audio";

type Phase = "menu" | "show" | "recall" | "results";
type Fmt = "flash" | "trail";
type Mark = "" | "lit" | "hit" | "miss" | "reveal";

const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "3×3 grid", note: 523 },
  { key: "hard", label: "Hard", sub: "4×4 grid", note: 659 },
  { key: "brutal", label: "Brutal", sub: "5×5 grid", note: 784 },
];
const GRID: Record<string, number> = { easy: 3, hard: 4, brutal: 5 };
const FLASH_MS: Record<string, number> = { easy: 1400, hard: 1100, brutal: 800 };  // whole pattern shown
const STEP_MS: Record<string, number> = { easy: 520, hard: 400, brutal: 300 };     // per tile, trail
const FORMATS = [
  { key: "flash", label: "Flash · all at once" },
  { key: "trail", label: "Trail · in order" },
];
const LIVES = 3;

/** Pentatonic pitch per tile: higher rows ring higher, columns step up. */
function tileFreq(i: number, n: number): number {
  const scale = [0, 2, 4, 7, 9];
  const row = Math.floor(i / n), col = i % n;
  const deg = col + (n - 1 - row);
  const semis = Math.floor(deg / 5) * 12 + scale[deg % 5];
  return 261.63 * Math.pow(2, semis / 12);
}

/* mutable run state lives in a ref so timers never see stale closures */
type Run = {
  rng: () => number;
  level: number;        // current level (1-based)
  lives: number;
  cleared: number;      // levels completed
  tiles: number;        // tiles correctly recalled across the run
  taps: number;         // total taps
  pattern: number[];
  picked: number[];
  marks: Mark[];
  head: string;
  flip: boolean;
};

type View = Omit<Run, "rng">;
const EMPTY_VIEW: View = {
  level: 1, lives: LIVES, cleared: 0, tiles: 0, taps: 0,
  pattern: [], picked: [], marks: [], head: "", flip: false,
};

export default function MemoryGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = usePref("memory-diff", "easy");
  const [modeStr, setMode] = usePref("memory-mode", "free");
  const mode = modeStr as Mode;
  const [fmtStr, setFmt] = usePref("memory-fmt", "flash");
  const fmt = fmtStr as Fmt;
  const [runStamp, setRunStamp] = useState(0);
  const [record, setRecord] = useState(false);
  /* render-side snapshot of the run; logic mutates the ref, then publishes */
  const [view, setView] = useState<View>(EMPTY_VIEW);

  const n = GRID[diff];
  const cells = n * n;
  const R = useRef<Run>({
    rng: Math.random, level: 1, lives: LIVES, cleared: 0, tiles: 0, taps: 0,
    pattern: [], picked: [], marks: [], head: "", flip: false,
  });
  const timers = useRef<number[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const publish = () => { const { rng: _rng, ...rest } = R.current; void _rng; setView({ ...rest }); };
  const setMarks = (m: Mark[], head?: string) => {
    R.current.marks = m;
    if (head !== undefined) R.current.head = head;
    publish();
  };
  const blank = () => Array<Mark>(cells).fill("");
  const ring = (i: number, vol = 0.07, dur = 0.22) => uiBlip(tileFreq(i, n) / 2, vol, dur);

  /* ---------- a level: build the pattern, show it, hand over ---------- */
  const runLevel = () => {
    const g = R.current;
    const count = Math.min(g.level + 2, cells - 1);
    const pool = Array.from({ length: cells }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {           // partial Fisher–Yates, seeded
      const j = Math.floor(g.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    g.pattern = pool.slice(0, count);
    g.picked = [];
    g.flip = false;
    setPhase("show");
    setMarks(blank(), "Watch");

    if (fmt === "flash") {
      later(() => {
        const m = blank();
        g.pattern.forEach((p) => { m[p] = "lit"; });
        setMarks(m);
        g.pattern.forEach((p, k) => later(() => ring(p, 0.045, 0.16), k * 45));
        later(() => {
          setMarks(blank());
          later(() => { setMarks(blank(), "Your turn"); setPhase("recall"); }, 260);
        }, FLASH_MS[diff]);
      }, 380);
    } else {
      const step = STEP_MS[diff];
      g.pattern.forEach((p, k) => {
        later(() => {
          const m = blank(); m[p] = "lit"; setMarks(m); ring(p, 0.06, 0.2);
        }, 380 + k * step);
        later(() => setMarks(blank()), 380 + k * step + step * 0.68);
      });
      later(() => { setMarks(blank(), "Your turn"); setPhase("recall"); }, 380 + g.pattern.length * step + 200);
    }
  };

  const start = () => {
    clear();
    R.current = {
      rng: rngFor(mode, "memory", diff), level: 1, lives: LIVES, cleared: 0, tiles: 0, taps: 0,
      pattern: [], picked: [], marks: [], head: "", flip: false,
    };
    runLevel();
  };

  const finish = () => {
    const g = R.current;
    const key = scoreKey("memory", mode, diff);
    const isRecord = g.cleared > getBest(key) && g.cleared > 0;
    if (isRecord) setBest(key, g.cleared);
    setRecord(isRecord);
    recordPlay("memory");
    setRunStamp(Date.now());
    setPhase("results");
  };

  const tap = (i: number) => {
    const g = R.current;
    if (phase !== "recall" || g.marks[i] === "hit") return;
    g.taps++;
    const want = fmt === "trail" ? g.pattern[g.picked.length] === i : g.pattern.includes(i);
    const m = [...g.marks];

    if (want) {
      g.picked.push(i);
      g.tiles++;
      m[i] = "hit";
      ring(i);
      if (g.picked.length < g.pattern.length) { setMarks(m); return; }
      /* level cleared */
      g.cleared++;
      g.level++;
      g.flip = true;
      setPhase("show");
      setMarks(m, "Nice");
      [0, 1, 2].forEach((k) => later(() => uiBlip(523 * Math.pow(2, k / 3), 0.05, 0.14), 60 + k * 70));
      later(runLevel, 720);
      return;
    }

    /* wrong tile: show what the pattern was, burn a life */
    g.lives--;
    m[i] = "miss";
    g.pattern.forEach((p) => { if (m[p] !== "hit") m[p] = "reveal"; });
    buzz();
    setPhase("show");
    setMarks(m, g.lives > 0 ? "Miss" : "Out of lives");
    later(g.lives > 0 ? runLevel : finish, 1100);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "menu" && !document.fullscreenElement) { clear(); setPhase("menu"); return; }
      if (phase === "recall" && n === 3) {                 // numpad layout: 7 8 9 is the top row
        const k = parseInt(e.key, 10);
        if (k >= 1 && k <= 9) tap((2 - Math.floor((k - 1) / 3)) * 3 + (k - 1) % 3);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  /* ---------- render ---------- */
  if (phase === "menu") {
    return (
      <main className="stage">
        <Stagger style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <Item><h1 className="wordmark">Echo</h1></Item>
          <Item>
            <div className="memLogo" aria-hidden>
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className={[0, 4, 5, 7].includes(i) ? "on" : ""} style={{ animationDelay: `${(i % 4) * -0.9}s` }} />
              ))}
            </div>
          </Item>
          <Item><p className="tagline">Tiles light up, then go dark. Tap the pattern back — every level adds one more, and three misses end the run.</p></Item>
          <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <GameSetup game="memory" diffs={DIFFS} diff={diff} mode={mode}
              onDiff={setDiff} onMode={setMode} onStart={start} refreshToken={runStamp}
              formats={FORMATS} format={fmt} onFormat={setFmt} />
          </Item>
        </Stagger>
      </main>
    );
  }

  const g = view;
  const best = getBest(scoreKey("memory", mode, diff));
  const acc = g.taps ? Math.round((g.tiles / g.taps) * 100) : 100;

  if (phase === "show" || phase === "recall") {
    return (
      <main className="stage">
        <div className="tempoHud memHud">
          <span>Level <b>{g.level}</b></span>
          <span><b>{"●".repeat(g.lives)}{"○".repeat(LIVES - g.lives)}</b></span>
          <span><b>{g.pattern.length}</b> tiles</span>
          <span><b>{g.picked.length}/{g.pattern.length}</b> found</span>
          <span><b>{g.tiles}</b> recalled</span>
          <span><b>{acc}%</b> acc</span>
          {best > 0 && <span>best <b>{best}</b></span>}
        </div>
        <div className={`memHead ${g.head === "Miss" || g.head === "Out of lives" ? "bad" : ""}`}>{g.head}</div>
        <div
          className={`memGrid ${g.flip ? "clear" : ""} ${phase === "recall" ? "live" : ""}`}
          style={{ "--n": n } as CSSProperties}
          role="grid"
          aria-label={`${n} by ${n} tiles`}
        >
          {Array.from({ length: cells }, (_, i) => (
            <button
              key={i}
              className={`tile ${g.marks[i] ?? ""}`}
              data-silent
              aria-label={`Tile ${i + 1}`}
              onPointerDown={(e) => { if (e.button === 0) tap(i); }}
            />
          ))}
        </div>
        <div className="tapHint">
          {fmt === "trail" ? "Tap the tiles in the order they lit" : "Tap every tile that lit up"}
          {n === 3 && <span className="deskHint" style={{ position: "static", display: "block", marginTop: 6 }}>Keys 1–9 work like a numpad · Esc menu</span>}
        </div>
      </main>
    );
  }

  /* results */
  const verdict =
    g.cleared >= 12 ? "Photographic." :
    g.cleared >= 9 ? "Dialed in." :
    g.cleared >= 6 ? "Sharp." :
    g.cleared >= 3 ? "Getting there." : "Blink and it's gone.";

  return (
    <main className="stage resStage">
      {record && <Celebrate />}
      <Pop className="resHead">
        <h2 className="resVerdict">{verdict}</h2>
        <div className="resTotal">
          <b>Level {g.cleared}</b> · {mode} · {diff} · {fmt}
          {best > 0 && ` · best ${best}`}
        </div>
      </Pop>
      <Stagger className="statRow">
        <Item className="stat"><b>{g.cleared}</b><span>levels</span></Item>
        <Item className="stat"><b>{g.tiles}</b><span>tiles recalled</span></Item>
        <Item className="stat"><b>{acc}%</b><span>accuracy</span></Item>
        <Item className="stat"><b>{Math.min(g.cleared + 2, cells - 1)}</b><span>tiles at peak</span></Item>
      </Stagger>
      <div className="resActions">
        <button className="cta" data-note={440} onClick={start}>Play again</button>
        <ShareScore text={scoreCard(
          "Echo",
          `${diff} · ${fmt}${mode === "daily" ? ` · daily ${todayStamp()}` : ""}`,
          `Level ${g.cleared} ${"🟩".repeat(Math.min(g.cleared, 10))}${"⬛".repeat(Math.max(0, 10 - g.cleared))}`,
        )} />
        <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Options</button>
      </div>
    </main>
  );
}
