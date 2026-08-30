"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import ShareScore from "@/components/ShareScore";
import Celebrate from "@/components/Celebrate";
import { Stagger, Item, Pop } from "@/components/Fx";
import { getBest, setBest, scoreKey, runRng, usePref, recordPlay } from "@/lib/store";
import { scoreCard } from "@/lib/share";
import { uiBlip, pluck, buzz } from "@/lib/audio";

/*
 * Echo — numbered tiles appear on a grid, vanish, and you tap them back
 * in order before the clock runs out. Every level adds a tile.
 */

type Phase = "menu" | "show" | "recall" | "results";
type Fmt = "flash" | "trail";
type Mark = "" | "lit" | "hit" | "miss" | "reveal";

const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "4×4 · 1.1s per tile", note: 523 },
  { key: "hard", label: "Hard", sub: "5×5 · 0.85s per tile", note: 659 },
  { key: "brutal", label: "Brutal", sub: "6×6 · 0.65s per tile", note: 784 },
];
const GRID: Record<string, number> = { easy: 4, hard: 5, brutal: 6 };
const START_TILES = 4;                                                             // level 1
const FLASH: Record<string, [number, number]> = { easy: [800, 280], hard: [600, 220], brutal: [420, 160] }; // base + per tile
const STEP_MS: Record<string, number> = { easy: 480, hard: 380, brutal: 280 };     // trail, per tile
const RECALL_PER_TILE: Record<string, number> = { easy: 1100, hard: 850, brutal: 650 };
const RECALL_MIN = 2500;
const FORMATS = [
  { key: "flash", label: "Flash · numbers at once" },
  { key: "trail", label: "Trail · one by one" },
];
const LIVES = 3;

/** Pentatonic pitch for the k-th number (1-based): the sequence climbs as you get it right. */
function numFreq(k: number): number {
  const scale = [0, 2, 4, 7, 9];
  const d = k - 1;
  return 261.63 * Math.pow(2, (Math.floor(d / 5) * 12 + scale[d % 5]) / 12);
}

type Run = {
  rng: () => number;
  level: number;
  lives: number;
  cleared: number;      // levels completed
  tiles: number;        // tiles correctly recalled across the run
  taps: number;
  pattern: number[];    // cell index per number (pattern[0] is "1")
  picked: number;       // how many numbers found this level
  marks: Mark[];
  head: string;
  flip: boolean;
  limit: number;        // recall time allowed, ms
};
type View = Omit<Run, "rng">;
const EMPTY: View = {
  level: 1, lives: LIVES, cleared: 0, tiles: 0, taps: 0,
  pattern: [], picked: 0, marks: [], head: "", flip: false, limit: 0,
};

export default function MemoryGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = usePref("memory-diff", "easy");
  const [fmtStr, setFmt] = usePref("memory-fmt", "flash");
  const fmt = fmtStr as Fmt;
  const [runStamp, setRunStamp] = useState(0);
  const [record, setRecord] = useState(false);
  const [view, setView] = useState<View>(EMPTY);   // render-side snapshot; logic mutates the ref

  const n = GRID[diff];
  const cells = n * n;
  const R = useRef<Run>({ rng: Math.random, ...EMPTY });
  const timers = useRef<number[]>([]);
  const clock = useRef({ deadline: 0, total: 1, nextTick: 0 });
  const barRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
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

  /* ---------- a level: build, show, hand over with the clock running ---------- */
  const runLevel = () => {
    const g = R.current;
    const count = Math.min(g.level + START_TILES - 1, cells - 1);
    const pool = Array.from({ length: cells }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {           // Fisher–Yates, seeded
      const j = Math.floor(g.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    g.pattern = pool.slice(0, count);
    g.picked = 0;
    g.flip = false;
    g.limit = Math.max(RECALL_MIN, count * RECALL_PER_TILE[diff]);
    setPhase("show");
    setMarks(blank(), "Watch");

    const handOver = () => {
      clock.current = { deadline: performance.now() + g.limit, total: g.limit, nextTick: 0 };
      setMarks(blank(), "Your turn");
      setPhase("recall");
    };

    if (fmt === "flash") {
      const [base, per] = FLASH[diff];
      later(() => {
        const m = blank();
        g.pattern.forEach((p) => { m[p] = "lit"; });
        setMarks(m);
        g.pattern.forEach((_, k) => later(() => pluck(numFreq(k + 1), 0.05, 0.4), k * 55));
        later(() => { setMarks(blank()); later(handOver, 260); }, base + per * count);
      }, 380);
    } else {
      const step = STEP_MS[diff];
      g.pattern.forEach((p, k) => {
        later(() => { const m = blank(); m[p] = "lit"; setMarks(m); pluck(numFreq(k + 1), 0.07, 0.5); }, 380 + k * step);
        later(() => setMarks(blank()), 380 + k * step + step * 0.7);
      });
      later(handOver, 380 + count * step + 200);
    }
  };

  const start = () => {
    clear();
    R.current = { rng: runRng(), ...EMPTY };
    runLevel();
  };

  const finish = () => {
    const g = R.current;
    const key = scoreKey("memory", diff);
    const isRecord = g.cleared > getBest(key) && g.cleared > 0;
    if (isRecord) setBest(key, g.cleared);
    setRecord(isRecord);
    recordPlay("memory");
    setRunStamp((s) => s + 1);
    setPhase("results");
  };

  /** A miss (wrong tile, or the clock): reveal the order, burn a life. */
  const fail = (wrongCell: number | null, head: string) => {
    const g = R.current;
    g.lives--;
    const m = [...g.marks];
    if (wrongCell !== null) m[wrongCell] = "miss";
    g.pattern.forEach((p) => { if (m[p] !== "hit" && m[p] !== "miss") m[p] = "reveal"; });
    buzz();
    setPhase("show");
    setMarks(m, g.lives > 0 ? head : "Out of lives");
    later(g.lives > 0 ? runLevel : finish, 1400);
  };

  const tap = (i: number) => {
    const g = R.current;
    if (phase !== "recall" || g.marks[i] === "hit") return;
    g.taps++;
    if (g.pattern[g.picked] !== i) { fail(i, "Wrong order"); return; }

    g.picked++;
    g.tiles++;
    const m = [...g.marks];
    m[i] = "hit";
    pluck(numFreq(g.picked), 0.1, 0.65);
    if (g.picked < g.pattern.length) { setMarks(m); return; }

    /* level cleared */
    g.cleared++;
    g.level++;
    g.flip = true;
    setPhase("show");
    setMarks(m, "Clear");
    [0, 1, 2].forEach((k) => later(() => uiBlip(523 * Math.pow(2, k / 3), 0.05, 0.14), 60 + k * 70));
    later(runLevel, 760);
  };

  /* recall clock: bar drains, hundredths tick down, ticks accelerate in the last stretch */
  useEffect(() => {
    if (phase !== "recall") return;
    let raf = 0;
    const loop = () => {
      const cd = clock.current;
      const now = performance.now();
      const rem = Math.max(0, cd.deadline - now);
      const frac = rem / cd.total;
      if (barRef.current) barRef.current.style.transform = `scaleX(${frac})`;
      if (timeRef.current) timeRef.current.textContent = (rem / 1000).toFixed(2);
      if (rem <= 0) { fail(null, "Time"); return; }
      if (rem < 3000 && now >= cd.nextTick) {
        const p = 1 - rem / 3000;
        uiBlip(420 + p * 700, 0.03 + p * 0.03, 0.05);
        cd.nextTick = now + 90 + 420 * Math.pow(1 - p, 1.5);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
          <Item><h1 className="wordmark">Echo</h1></Item>
          <Item>
            <div className="memLogo" aria-hidden>
              {Array.from({ length: 9 }, (_, i) => {
                const k = [0, 4, 5, 7].indexOf(i);
                return <span key={i} className={k >= 0 ? "on" : ""} style={{ animationDelay: `${k * -0.9}s` }}>{k >= 0 ? k + 1 : ""}</span>;
              })}
            </div>
          </Item>
          <Item><p className="tagline">Numbered tiles appear, then vanish. Tap them back in order before the clock runs out — every level adds a tile, three misses end the run.</p></Item>
          <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <GameSetup game="memory" diffs={DIFFS} diff={diff}
              onDiff={setDiff} onStart={start} refreshToken={runStamp}
              formats={FORMATS} format={fmt} onFormat={setFmt}
              helpContent={{
                title: "Echo",
                description: "The board lights up, then wipes clean. You must tap the tiles back in the same order before time or lives run out.",
                steps: [
                  "Watch the highlighted tiles as the pattern appears.",
                  "Replay the pattern in order by tapping each tile as it lights up.",
                  "Each level grows longer, and three misses end the run.",
                ],
              }} />
          </Item>
        </Stagger>
      </main>
    );
  }

  const g = view;
  const best = getBest(scoreKey("memory", diff));
  const acc = g.taps ? Math.round((g.tiles / g.taps) * 100) : 100;
  const numberOf = (cell: number) => { const k = g.pattern.indexOf(cell); return k >= 0 ? k + 1 : ""; };

  if (phase === "show" || phase === "recall") {
    const bad = g.head === "Wrong order" || g.head === "Time" || g.head === "Out of lives";
    return (
      <main className="stage">
        <div className="tempoHud memHud">
          <span>Level <b>{g.level}</b></span>
          <span><b>{"●".repeat(g.lives)}{"○".repeat(LIVES - g.lives)}</b></span>
          <span><b>{g.picked}/{g.pattern.length}</b> in order</span>
          <span><b>{g.tiles}</b> recalled</span>
          <span><b>{acc}%</b> acc</span>
          {best > 0 && <span>best <b>{best}</b></span>}
        </div>
        <div className={`memHead ${bad ? "bad" : ""}`}>
          {g.head}
          {phase === "recall" && <span className="memTime" ref={timeRef}>{(g.limit / 1000).toFixed(2)}</span>}
        </div>
        <div className="memBar" aria-hidden>
          <div ref={barRef} style={{ transform: phase === "recall" ? undefined : "scaleX(0)" }} />
        </div>
        <div
          className={`memGrid ${g.flip ? "clear" : ""} ${phase === "recall" ? "live" : ""}`}
          style={{ "--n": n } as CSSProperties}
          role="grid"
          aria-label={`${n} by ${n} tiles`}
        >
          {Array.from({ length: cells }, (_, i) => {
            const mk = g.marks[i] ?? "";
            return (
              <button
                key={i}
                className={`tile ${mk}`}
                data-silent
                aria-label={`Tile ${i + 1}`}
                onPointerDown={(e) => { if (e.button === 0) tap(i); }}
              >
                {mk === "lit" || mk === "hit" || mk === "reveal" ? numberOf(i) : ""}
              </button>
            );
          })}
        </div>
        <div className="tapHint">
          Tap 1, 2, 3… in order · {(g.limit / 1000).toFixed(1)}s on the clock
          <span className="deskHint" style={{ position: "static", display: "block", marginTop: 6 }}>Esc menu</span>
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
          <b>Level {g.cleared}</b> · {diff} · {fmt}
          {best > 0 && ` · best ${best}`}
        </div>
      </Pop>
      <Stagger className="statRow">
        <Item className="stat"><b>{g.cleared}</b><span>levels</span></Item>
        <Item className="stat"><b>{g.tiles}</b><span>tiles recalled</span></Item>
        <Item className="stat"><b>{acc}%</b><span>accuracy</span></Item>
        <Item className="stat"><b>{Math.min(g.cleared + START_TILES, cells - 1)}</b><span>tiles at peak</span></Item>
      </Stagger>
      <div className="resActions">
        <button className="cta" data-note={440} onClick={start}>Play again</button>
        <ShareScore text={scoreCard(
          "Echo",
          `${diff} · ${fmt}`,
          `Level ${g.cleared} ${"🟩".repeat(Math.min(g.cleared, 10))}${"⬛".repeat(Math.max(0, 10 - g.cleared))}`,
        )} />
        <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Options</button>
      </div>
    </main>
  );
}
