"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import ShareScore from "@/components/ShareScore";
import Celebrate from "@/components/Celebrate";
import { Stagger, Item, Pop } from "@/components/Fx";
import { getBest, setBest, scoreKey, rngFor, usePref, todayStamp, recordPlay, type Mode } from "@/lib/store";
import { scoreCard } from "@/lib/share";
import { uiBlip, pianoKey, buzz } from "@/lib/audio";
import { speakCue, setVoiceCuesEnabled, voiceCuesAvailable } from "@/lib/voice";

/*
 * Refrain — a piano melody grows one note every level. Play the same
 * notes back in order before the clock runs out; three slips end it.
 */

type Phase = "menu" | "show" | "recall" | "results";
type Fmt = "watch" | "ear";
type Mark = "" | "lit" | "hit" | "miss" | "reveal";
type PhrasePreset = "auto" | "west" | "snap";

const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "8 keys · white only", note: 523 },
  { key: "hard", label: "Hard", sub: "13 keys · chromatic", note: 659 },
  { key: "brutal", label: "Brutal", sub: "17 keys · 1½ octaves", note: 784 },
];
const SPAN: Record<string, number> = { easy: 13, hard: 13, brutal: 17 };
const WHITES_ONLY: Record<string, boolean> = { easy: true, hard: false, brutal: false };
const STEP_MS: Record<string, number> = { easy: 520, hard: 440, brutal: 360 };
const RECALL_PER_NOTE: Record<string, number> = { easy: 1400, hard: 1200, brutal: 1000 };
const RECALL_MIN = 3000;
const START_NOTES = 3;
const LIVES = 3;
const FORMATS = [
  { key: "watch", label: "Watch · keys light up" },
  { key: "ear", label: "By ear · sound only" },
];
const PHRASES = [
  { key: "auto", label: "Phrase", sub: "Auto" },
  { key: "west", label: "Phrase", sub: "West Coast · inspired" },
  { key: "snap", label: "Phrase", sub: "Snap Bounce · inspired" },
];

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);
const WHITE_HINTS = "ASDFGHJKL;'";
const BLACK_HINTS = "WETYUOP[";
const freqOf = (semi: number) => 261.63 * Math.pow(2, semi / 12); // C4 up

type PKey = { freq: number; name: string; black: boolean; left: number; width: number; hint: string };

/** Lay a keyboard out left-to-right: whites split the row, blacks straddle the seams. */
function buildKeys(span: number, whitesOnly: boolean): PKey[] {
  const defs: { s: number; black: boolean }[] = [];
  let whites = 0;
  for (let s = 0; s < span; s++) {
    const black = BLACK.has(s % 12);
    if (whitesOnly && black) continue;
    defs.push({ s, black });
    if (!black) whites++;
  }
  const wW = 100 / whites;
  const bW = wW * 0.62;
  const keys: PKey[] = [];
  let wIdx = 0, wh = 0, bh = 0;
  for (const d of defs) {
    const name = NAMES[d.s % 12] + (4 + Math.floor(d.s / 12));
    if (d.black) {
      keys.push({ freq: freqOf(d.s), name, black: true, left: wIdx * wW - bW / 2, width: bW, hint: BLACK_HINTS[bh++] ?? "" });
    } else {
      keys.push({ freq: freqOf(d.s), name, black: false, left: wIdx * wW, width: wW, hint: WHITE_HINTS[wh++] ?? "" });
      wIdx++;
    }
  }
  return keys;
}

type Run = {
  rng: () => number;
  level: number;
  lives: number;
  cleared: number;     // levels completed
  notes: number;       // notes correctly played across the run
  taps: number;
  melody: number[];    // key index per note — grows by one every level
  picked: number;      // notes matched so far this level
  marks: Mark[];
  head: string;
  limit: number;       // recall time allowed, ms
  phrase: PhrasePreset;
  phraseBank: number[];
};
type View = Omit<Run, "rng">;
const EMPTY: View = {
  level: 1, lives: LIVES, cleared: 0, notes: 0, taps: 0,
  melody: [], picked: 0, marks: [], head: "", limit: 0,
  phrase: "auto", phraseBank: [],
};

function buildInspiredPhrase(preset: Exclude<PhrasePreset, "auto">, n: number): number[] {
  const center = Math.floor(n / 2);
  const motif = preset === "west"
    // Sparse minor-pentatonic bounce with low-return turns.
    ? [0, -3, -5, -3, 0, 2, 4, 2, -1, -3, -6, -3, 0, 2, -1, -3]
    // Brighter, more repetitive call/response for snap-style hooks.
    : [0, 0, 3, 5, 3, 0, -2, 0, 0, 2, 3, 2, 0, -2, 0, -2];
  const seq: number[] = [];
  for (let i = 0; i < 64; i++) {
    const cycle = Math.floor(i / motif.length);
    const drift = preset === "west"
      ? (cycle % 4 === 3 ? -1 : 0) // occasional drop for that cruising low-end pull
      : ((cycle % 3) - 1);
    const idx = Math.max(0, Math.min(n - 1, center + motif[i % motif.length] + drift));
    seq.push(idx);
  }
  return seq;
}

export default function PianoGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = usePref("piano-diff", "easy");
  const [modeStr, setMode] = usePref("piano-mode", "free");
  const mode = modeStr as Mode;
  const [fmtStr, setFmt] = usePref("piano-fmt", "watch");
  const fmt = fmtStr as Fmt;
  const [phraseStr, setPhrase] = usePref("piano-phrase", "auto");
  const phrase = phraseStr as PhrasePreset;
  const [voiceCues, setVoiceCues] = usePref("voice-cues", "on");
  const [runStamp, setRunStamp] = useState(0);
  const [record, setRecord] = useState(false);
  const [view, setView] = useState<View>(EMPTY);   // render-side snapshot; logic mutates the ref

  const keys = useMemo(() => buildKeys(SPAN[diff], WHITES_ONLY[diff]), [diff]);
  const R = useRef<Run>({ rng: Math.random, ...EMPTY });
  const timers = useRef<number[]>([]);
  const clock = useRef({ deadline: 0, total: 1, nextTick: 0 });
  const barRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);
  useEffect(() => { setVoiceCuesEnabled(voiceCues === "on"); }, [voiceCues]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const publish = () => { const { rng: _rng, ...rest } = R.current; void _rng; setView({ ...rest }); };
  const setMarks = (m: Mark[], head?: string) => {
    R.current.marks = m;
    if (head !== undefined) R.current.head = head;
    publish();
  };
  const blank = () => Array<Mark>(keys.length).fill("");

  /** Grow the melody: a seeded random walk in small steps — singable, never static. */
  const extend = () => {
    const g = R.current;
    const n = keys.length;
    const add = g.melody.length === 0 ? START_NOTES : 1;
    if (g.phrase !== "auto") {
      for (let k = 0; k < add; k++) {
        const i = g.melody.length;
        g.melody.push(g.phraseBank[i % g.phraseBank.length]);
      }
      return;
    }
    for (let k = 0; k < add; k++) {
      const prev = g.melody[g.melody.length - 1];
      let next: number;
      if (prev === undefined) {
        next = Math.floor(n / 2 + g.rng() * 5 - 2);
      } else {
        const delta = (1 + Math.floor(g.rng() * 4)) * (g.rng() < 0.5 ? -1 : 1);
        next = prev + delta;
        if (next < 0 || next >= n) next = prev - delta;
        next = Math.max(0, Math.min(n - 1, next));
        if (next === prev) next = prev + (prev > 0 ? -1 : 1);
      }
      g.melody.push(next);
    }
  };

  /* ---------- play the phrase, then hand over with the clock running ---------- */
  const playLevel = () => {
    const g = R.current;
    g.picked = 0;
    g.limit = Math.max(RECALL_MIN, g.melody.length * RECALL_PER_NOTE[diff]);
    setPhase("show");
    setMarks(blank(), "Listen");
    speakCue("listen");
    const step = STEP_MS[diff];
    g.melody.forEach((ki, k) => {
      later(() => {
        if (fmt === "watch") { const m = blank(); m[ki] = "lit"; setMarks(m); }
        pianoKey(keys[ki].freq, 0.15);
      }, 500 + k * step);
      if (fmt === "watch") later(() => setMarks(blank()), 500 + k * step + step * 0.72);
    });
    later(() => {
      clock.current = { deadline: performance.now() + g.limit, total: g.limit, nextTick: 0 };
      setMarks(blank(), "Your turn");
      setPhase("recall");
      speakCue("your turn");
    }, 500 + g.melody.length * step + 260);
  };

  const start = () => {
    clear();
    const rng = rngFor(mode, "piano", diff);
    const phraseBank = phrase === "auto" ? [] : buildInspiredPhrase(phrase, keys.length);
    R.current = { rng, ...EMPTY, melody: [], marks: [], phrase, phraseBank };
    extend();
    playLevel();
  };

  const finish = () => {
    const g = R.current;
    const key = scoreKey("piano", mode, diff);
    const isRecord = g.cleared > getBest(key) && g.cleared > 0;
    if (isRecord) setBest(key, g.cleared);
    setRecord(isRecord);
    recordPlay("piano");
    setRunStamp((s) => s + 1);
    setPhase("results");
  };

  /** A slip (wrong key, or the clock): show the note that should have come, burn a life. */
  const fail = (wrongKey: number | null, head: string) => {
    const g = R.current;
    g.lives--;
    const m = blank();
    if (wrongKey !== null) m[wrongKey] = "miss";
    m[g.melody[g.picked]] = "reveal";
    buzz();
    speakCue(wrongKey === null ? "time" : "wrong note");
    setPhase("show");
    setMarks(m, g.lives > 0 ? head : "Out of lives");
    later(g.lives > 0 ? playLevel : finish, 1500);
  };

  /** Brief flash on a played key, then back to rest. */
  const flash = (i: number, mk: Mark) => {
    const m = [...R.current.marks];
    m[i] = mk;
    setMarks(m);
    later(() => {
      if (R.current.marks[i] !== mk) return;
      const m2 = [...R.current.marks];
      m2[i] = "";
      setMarks(m2);
    }, 220);
  };

  const press = (i: number) => {
    const g = R.current;
    if (phase !== "recall") return;
    g.taps++;
    pianoKey(keys[i].freq, 0.14);
    if (g.melody[g.picked] !== i) { fail(i, "Wrong note"); return; }

    g.picked++;
    g.notes++;
    flash(i, "hit");
    publish();
    if (g.picked < g.melody.length) return;

    /* level cleared — same melody next time, one note longer */
    g.cleared++;
    g.level++;
    setPhase("show");
    setMarks(g.marks, "Clear");
    speakCue("clear");
    [0, 1, 2].forEach((k) => later(() => uiBlip(523 * Math.pow(2, k / 3), 0.05, 0.14), 60 + k * 70));
    later(() => { extend(); playLevel(); }, 860);
  };
  const pressRef = useRef(press);
  useEffect(() => { pressRef.current = press; });

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

  /* the computer keyboard is a piano too: A–' whites, W–[ blacks */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phase !== "menu" && !document.fullscreenElement) { e.preventDefault(); clear(); setPhase("menu"); }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (phase !== "show" && phase !== "recall") return;
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const i = keys.findIndex((p) => p.hint === k);
      if (i >= 0) { e.preventDefault(); pressRef.current(i); }  // claims F/B from the chrome
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, keys]);

  /* ---------- render ---------- */
  if (phase === "menu") {
    return (
      <main className="stage">
        <Stagger style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <Item><h1 className="wordmark">Refrain</h1></Item>
          <Item>
            <svg className="pianoLogo" viewBox="0 0 192 60" aria-hidden>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <rect key={`w${i}`} x={i * 24 + 1} y={1} width={22} height={58} rx={3}
                  fill="#eff0f4"
                  style={[1, 4].includes(i) ? { animation: "logoPulse 3.6s ease-in-out infinite", animationDelay: `${i * -0.9}s` } : undefined} />
              ))}
              {[0, 1, 3, 4, 5].map((i) => (
                <rect key={`b${i}`} x={i * 24 + 16} y={1} width={15} height={34} rx={2.5}
                  fill="#0c0d12" stroke="rgba(239,240,244,.25)"
                  style={i === 3 ? { animation: "logoPulse 3.6s ease-in-out infinite", animationDelay: "-1.8s" } : undefined} />
              ))}
            </svg>
          </Item>
          <Item><p className="tagline">A piano phrase plays, then it&apos;s yours — hit the same notes in the same order. Every level adds a note to the same melody; three slips end the run.</p></Item>
          <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <GameSetup game="piano" diffs={DIFFS} diff={diff} mode={mode}
              onDiff={setDiff} onMode={setMode} onStart={start} refreshToken={runStamp}
              formats={FORMATS} format={fmtStr} onFormat={setFmt}
              beats={PHRASES} beat={phraseStr} onBeat={setPhrase}
              helpContent={{
                title: "Refrain",
                description: "A melody plays one note at a time, then you must repeat that exact phrase back on the piano in the same order.",
                steps: [
                  "Listen to the phrase as it plays.",
                  "Press the same white and black keys in sequence.",
                  "Every level adds another note, and mistakes cost lives.",
                ],
              }} />
            <div className="modes" role="group" aria-label="Voice cues">
              <button className="mode" aria-pressed={voiceCues === "off"} data-note={330} onClick={() => setVoiceCues("off")}>
                Voice cues off
              </button>
              <button
                className="mode"
                aria-pressed={voiceCues === "on"}
                data-note={392}
                onClick={() => setVoiceCues("on")}
              >
                Voice cues on{voiceCuesAvailable() ? "" : " (no endpoint)"}
              </button>
            </div>
          </Item>
        </Stagger>
      </main>
    );
  }

  const g = view;
  const best = getBest(scoreKey("piano", mode, diff));
  const acc = g.taps ? Math.round((g.notes / g.taps) * 100) : 100;

  if (phase === "show" || phase === "recall") {
    const bad = g.head === "Wrong note" || g.head === "Time" || g.head === "Out of lives";
    return (
      <main className="stage">
        <div className="tempoHud memHud">
          <span>Level <b>{g.level}</b></span>
          <span><b>{"●".repeat(g.lives)}{"○".repeat(LIVES - g.lives)}</b></span>
          <span><b>{g.picked}/{g.melody.length}</b> notes</span>
          <span><b>{g.notes}</b> played</span>
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
        <div className={`pianoWrap ${phase === "recall" ? "live" : ""}`} role="group" aria-label="Piano keyboard">
          {keys.map((k, i) => {
            const mk = g.marks[i] ?? "";
            return (
              <button
                key={i}
                className={`pKey ${k.black ? "black" : "white"} ${mk}`}
                style={{ left: `${k.left}%`, width: `${k.width}%` }}
                data-silent
                aria-label={k.name}
                onPointerDown={(e) => { if (e.button === 0) press(i); }}
              >
                <span className="noteLabel" aria-hidden>{k.name}</span>
                {k.hint && <small>{k.hint}</small>}
              </button>
            );
          })}
        </div>
        <div className="tapHint">
          Same notes, same order · {(g.limit / 1000).toFixed(1)}s on the clock
          <span className="deskHint" style={{ position: "static", display: "block", marginTop: 6 }}>
            A–&apos; whites · W–[ blacks · Esc menu
          </span>
        </div>
      </main>
    );
  }

  /* results */
  const verdict =
    g.cleared >= 12 ? "Virtuoso." :
    g.cleared >= 9 ? "Concert ready." :
    g.cleared >= 6 ? "In tune." :
    g.cleared >= 3 ? "Finding the key." : "Warming up.";

  return (
    <main className="stage resStage">
      {record && <Celebrate />}
      <Pop className="resHead">
        <h2 className="resVerdict">{verdict}</h2>
        <div className="resTotal">
          <b>Level {g.cleared}</b> · {mode} · {diff} · {fmt === "watch" ? "watch" : "by ear"}
          {g.phrase !== "auto" && ` · ${g.phrase === "west" ? "west coast" : "snap bounce"}`}
          {best > 0 && ` · best ${best}`}
        </div>
      </Pop>
      <Stagger className="statRow">
        <Item className="stat"><b>{g.cleared}</b><span>levels</span></Item>
        <Item className="stat"><b>{g.notes}</b><span>notes played</span></Item>
        <Item className="stat"><b>{acc}%</b><span>accuracy</span></Item>
        <Item className="stat"><b>{g.melody.length}</b><span>notes at peak</span></Item>
      </Stagger>
      <div className="resActions">
        <button className="cta" data-note={440} onClick={start}>Play again</button>
        <ShareScore text={scoreCard(
          "Refrain",
          `${diff} · ${fmt === "watch" ? "watch" : "by ear"}${mode === "daily" ? ` · daily ${todayStamp()}` : ""}`,
          `🎹 Level ${g.cleared} ${"🟩".repeat(Math.min(g.cleared, 10))}${"⬛".repeat(Math.max(0, 10 - g.cleared))}`,
        )} />
        <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Options</button>
      </div>
    </main>
  );
}
