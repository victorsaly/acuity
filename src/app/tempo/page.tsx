"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import Leaderboard from "@/components/Leaderboard";
import ShareScore from "@/components/ShareScore";
import Celebrate from "@/components/Celebrate";
import { Stagger, Item, Pop } from "@/components/Fx";
import GameMark from "@/components/GameMark";
import { audio, kick, snare, hat, click, uiBlip, setDrumKit, loadKitSamples, type DrumKitName } from "@/lib/audio";
import { getBest, setBest, scoreKey, runRng, usePref, recordPlay, seededRng, dailySeed, dayNumber, todayStamp } from "@/lib/store";
import { readToken, signIn, submitScore, useSignedIn } from "@/lib/arcade";
import { readAccent, shade } from "@/lib/accent";
import { barEmoji } from "@/lib/share";

type Phase = "menu" | "play" | "results" | "board";

const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "1 track", note: 523 },
  { key: "medium", label: "Medium", sub: "1 track+", note: 587 },
  { key: "hard", label: "Hard", sub: "2 tracks", note: 659 },
  { key: "brutal", label: "Brutal", sub: "3 tracks", note: 784 },
];
const DIFF_KEYS = DIFFS.map((d) => d.key);

/* 16-step bar patterns. Player taps every kick + snare. */
type Pattern = { kick: number[]; snare: number[]; hat: number[]; open?: number[] };
const PATTERNS: Record<string, Pattern> = {
  basic: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  boomBap: { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  gFunk: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [10] },
  club: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
  breaks: { kick: [0, 3, 6, 10], snare: [4, 12, 15], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [7] },
  stillDre: { kick: [0, 3, 8, 10, 14], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [7, 15] },
  crankThat: { kick: [0, 6, 7, 10, 11, 14], snare: [4, 12], hat: [0, 2, 3, 6, 8, 10, 11, 14], open: [15] },
};
const DIFF_CFG: Record<string, { tracks: { p: string; bars: number; label?: string }[]; bpm: [number, number] }> = {
  easy: { tracks: [{ p: "basic", bars: 8 }], bpm: [76, 96] },
  medium: { tracks: [{ p: "boomBap", bars: 10 }], bpm: [88, 108] },
  hard: {
    tracks: [
      { p: "stillDre", bars: 8, label: "Still D.R.E." },
      { p: "crankThat", bars: 8, label: "Crank That" },
    ],
    bpm: [96, 126],
  },
  brutal: {
    tracks: [
      { p: "stillDre", bars: 8, label: "Still D.R.E." },
      { p: "breaks", bars: 8 },
      { p: "crankThat", bars: 8, label: "Crank That" },
    ],
    bpm: [108, 140],
  },
};

const APPROACH = 1.8;               // seconds a note is on screen before the ring
const W_PERFECT = 0.05, W_GOOD = 0.1, W_OK = 0.15;

/* monochrome rocks: kicks read as filled, snares as hollow */
const KICK_COL = "#ffffff";
const SNARE_COL = "#ffffff";
const TRACK_COLS = ["#3dc9ff", "#ffb454", "#a4ff4f"]; // per-track progress colors

const KITS_UI = [
  { key: "punch", label: "Punch" },
  { key: "boom", label: "Boom" },
  { key: "club", label: "Club" },
  { key: "wood", label: "Wood" },
];
const KIT_KEYS = KITS_UI.map((k) => k.key);

const TRACKS_UI = [
  { key: "auto", label: "Track", sub: "Auto" },
  { key: "stillDre", label: "Track", sub: "Still D.R.E." },
  { key: "crankThat", label: "Track", sub: "Crank That" },
];
const TRACK_KEYS = TRACKS_UI.map((t) => t.key);
const TRACK_LABELS: Record<string, string> = {
  stillDre: "Still D.R.E.",
  crankThat: "Crank That",
};

type LaneStyle = "curve" | "orbit" | "rain";
/* Each lane is its own game type, so each gets its own line-art mark. */
const laneIcon = (paths: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {paths}
  </svg>
);
const LANES_UI = [
  {
    key: "curve", label: "Curve", sub: "Sweep in",
    icon: laneIcon(<>
      <path d="M9.5 2.5C7.5 9 5.5 14 3 20.5" />
      <path d="M14.5 2.5C16.5 9 18.5 14 21 20.5" />
      <ellipse cx="12" cy="18" rx="6.6" ry="2.4" />
      <circle cx="12" cy="9.2" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="9.6" cy="5" r="1" fill="currentColor" stroke="none" />
    </>),
  },
  {
    key: "orbit", label: "Orbit", sub: "Circle in",
    icon: laneIcon(<>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="12" cy="3.4" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="19" cy="16.4" r="1.1" fill="currentColor" stroke="none" />
    </>),
  },
  {
    key: "rain", label: "Rain", sub: "Drop in",
    icon: laneIcon(<>
      <path d="M6 2.5v4.5" />
      <path d="M12 4v5.5" />
      <path d="M18 2.5v3.5" />
      <circle cx="6" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M2.5 18.5h19" />
    </>),
  },
];
const LANE_KEYS = LANES_UI.map((l) => l.key);
/* rain: each note owns a deterministic column */
const rainX = (n: Note, W: number) => W * (0.5 + 0.36 * Math.sin(n.t * 5.3));

const hexRgb = (h: string): [number, number, number] =>
  [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbaHex = (h: string, a: number) => {
  const [rr, gg, bb] = hexRgb(h);
  return `rgba(${rr},${gg},${bb},${a})`;
};
const mixHex = (a: string, b: string, t: number, alpha = 1) => {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgba(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")},${alpha})`;
};

/** Every note is an asteroid: a lumpy rock (shape seeded by its beat
    time) tumbling toward the ring. Perfect → white explosion, good →
    colored burst, late/early → it ricochets off the ring, miss → it
    sails straight past. */
function drawAsteroid(
  g2: CanvasRenderingContext2D, x: number, y: number, rad: number,
  seed: number, rot: number, fill: string | null, stroke: string, dpr: number,
) {
  const n = 9;
  g2.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const bump = Math.sin(seed * 13.7 + i * 7.1) * 0.5 + 0.5;
    const r = rad * (0.72 + bump * 0.36);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) g2.lineTo(px, py); else g2.moveTo(px, py);
  }
  g2.closePath();
  if (fill) { g2.fillStyle = fill; g2.fill(); }
  g2.strokeStyle = stroke;
  g2.lineWidth = Math.max(1.2, rad * 0.12);
  g2.lineJoin = "round";
  g2.stroke();
  if (rad > 9 * dpr) {   // a few craters
    g2.fillStyle = fill ? "rgba(12,13,18,.38)" : stroke;
    for (let i = 0; i < 3; i++) {
      const a = seed * 5.3 + i * 2.1 + rot;
      const d = rad * (0.22 + 0.3 * ((Math.sin(seed * 3.1 + i) + 1) / 2));
      g2.beginPath();
      g2.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rad * (0.09 + 0.05 * i), 0, Math.PI * 2);
      g2.fill();
    }
  }
}

function spawnBurst(
  fx: Fx[], x: number, y: number, now: number, col: string,
  count: number, speed: number, size: number, flash: boolean,
) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.9);
    fx.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      born: now, life: 0.5 + Math.random() * 0.4, col, size: size * (0.5 + Math.random()), kind: "shard",
    });
  }
  if (flash) fx.push({ x, y, vx: 0, vy: 0, born: now, life: 0.4, col, size, kind: "flash" });
}

type Ev = { t: number; type: "kick" | "snare" | "hat" | "open" | "click"; f?: number };
type Note = {
  t: number; kind: "kick" | "snare"; state: "pending" | "hit" | "miss"; value: number;
  /* set on the first frame after a hit: where it died, and (if deflected) its ricochet */
  hx?: number; hy?: number; hitT?: number; dvx?: number; dvy?: number;
};
type Fx = {
  x: number; y: number; vx: number; vy: number;
  born: number; life: number; col: string; size: number; kind: "shard" | "flash";
};
type TrackMark = { from: number; to: number; label: string; bpm: number };

const runScore = (r: Run) =>
  Math.max(0, ((r.points - r.strays * 0.15) / Math.max(1, r.notes.length)) * 100);

type Judgement = { text: string; color: string; blip: number };

/** Mutates the run: judge one tap at nowT against the nearest pending note. */
function applyTap(r: Run, nowT: number): Judgement {
  let best: Note | null = null;
  let bestDt = Infinity;
  for (const n of r.notes) {
    if (n.state !== "pending") continue;
    const dt = nowT - n.t;
    if (dt > W_OK) continue;
    if (n.t - nowT > W_OK) break;
    if (Math.abs(dt) < Math.abs(bestDt)) { best = n; bestDt = dt; }
  }
  r.ringPulse = 1;
  if (!best) {
    r.strays++;
    r.combo = 0;
    r.flashCol = "#6a6a72";
    return { text: "early", color: "#8a8a92", blip: 200 };
  }
  const a = Math.abs(bestDt);
  best.state = "hit";
  const col = best.kind === "kick" ? KICK_COL : SNARE_COL;
  r.flashCol = col;
  let j: Judgement;
  if (a <= W_PERFECT) {
    best.value = 1; r.counts.perfect++; r.combo++;
    j = { text: "perfect", color: col, blip: 1046 };
  } else if (a <= W_GOOD) {
    best.value = 0.6; r.counts.good++; r.combo++;
    j = { text: bestDt < 0 ? "good · early" : "good · late", color: "#cfcfd6", blip: 784 };
  } else {
    best.value = 0.3; r.counts.ok++; r.combo = 0;
    j = { text: bestDt < 0 ? "almost · early" : "almost · late", color: "#8a8a92", blip: 523 };
  }
  r.points += best.value;
  r.maxCombo = Math.max(r.maxCombo, r.combo);
  return j;
}

type Run = {
  events: Ev[]; evIdx: number;
  notes: Note[];
  marks: TrackMark[];
  beats: number[]; beatIdx: number;
  startT: number; endT: number;
  points: number; strays: number; combo: number; maxCombo: number;
  counts: { perfect: number; good: number; ok: number; miss: number };
  pulse: number; ringPulse: number; flashCol: string;
  ringEase: number;
  fx: Fx[];
  done: boolean;
};

export default function TempoGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = usePref("tempo-diff", "medium", DIFF_KEYS);
  const [kitStr, setKit] = usePref("tempo-kit", "punch", KIT_KEYS);
  const kit = kitStr as DrumKitName;
  const [trackPick, setTrackPick] = usePref("tempo-track", "auto", TRACK_KEYS);
  const [laneStr, setLane] = usePref("tempo-lane", "curve", LANE_KEYS);
  const lane = laneStr as LaneStyle;
  const [runStamp, setRunStamp] = useState(0);
  const [hud, setHud] = useState({ track: "", bpm: 0, combo: 0, pts: 0 });
  const [judge, setJudge] = useState<{ text: string; id: number; color: string } | null>(null);
  const [final, setFinal] = useState<Run | null>(null);
  const [record, setRecord] = useState(false);
  /* Whether this run is today's shared challenge, and its seed. Only a seeded
     run can be rebuilt server-side, so only a seeded run can be ranked. */
  const [daily, setDaily] = usePref("beats-daily", "off", ["off", "on"]);
  const seedRef = useRef<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  /* Whether the finished run was the daily. State, not the ref: this is read
     while rendering the results, and a ref does not re-render. */
  const [rankedRun, setRankedRun] = useState(false);
  const signedIn = useSignedIn(phase);

  const run = useRef<Run | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { loadKitSamples(kit); }, [kit]);   // the chosen kit fetches in the background; synth covers until then

  /* ---------- build the whole timeline up front ---------- */
  const start = () => {
    const c = audio();
    setDrumKit(kit);   // remembered preference may not have touched the engine yet
    /* Only the tempo comes from the seed; the notes are the pattern's own. */
    const seed = daily === "on" ? dailySeed(`tempo-${diff}`) : null;
    seedRef.current = seed;
    setRankedRun(seedRef.current !== null);
    setRank(null);
    const rng = seed === null ? runRng() : seededRng(seed);
    const baseCfg = DIFF_CFG[diff];
    const cfg = trackPick === "auto" ? baseCfg : {
      ...baseCfg,
      tracks: [{ p: trackPick, bars: baseCfg.tracks[0]?.bars ?? 8, label: TRACK_LABELS[trackPick] }],
    };
    const events: Ev[] = [];
    const notes: Note[] = [];
    const marks: TrackMark[] = [];
    const beats: number[] = [];
    let t = c.currentTime + 0.55;
    const startT = t;

    cfg.tracks.forEach((tr, ti) => {
      const bpm = Math.round(cfg.bpm[0] + rng() * (cfg.bpm[1] - cfg.bpm[0]));
      const spb = 60 / bpm;
      const step = spb / 4;
      const pat = PATTERNS[tr.p];
      const from = t;

      /* progressive count-in: each click steps up toward the downbeat */
      const COUNT_F = [523, 659, 784, 1046];
      for (let i = 0; i < 4; i++) { events.push({ t: t + i * spb, type: "click", f: COUNT_F[i] }); beats.push(t + i * spb); }
      t += 4 * spb;

      for (let bar = 0; bar < tr.bars; bar++) {
        for (let b = 0; b < 4; b++) beats.push(t + b * spb);
        pat.kick.forEach((s) => { events.push({ t: t + s * step, type: "kick" }); notes.push({ t: t + s * step, kind: "kick", state: "pending", value: 0 }); });
        pat.snare.forEach((s) => { events.push({ t: t + s * step, type: "snare" }); notes.push({ t: t + s * step, kind: "snare", state: "pending", value: 0 }); });
        pat.hat.forEach((s) => events.push({ t: t + s * step, type: "hat" }));
        pat.open?.forEach((s) => events.push({ t: t + s * step, type: "open" }));
        t += 16 * step;
      }
      const title = tr.label ? `${tr.label} · Track ${ti + 1}/${cfg.tracks.length}` : `Track ${ti + 1}/${cfg.tracks.length}`;
      marks.push({ from, to: t, label: title, bpm });
      t += 1.1; // breather between tracks
    });

    events.sort((a, b) => a.t - b.t);
    notes.sort((a, b) => a.t - b.t);

    run.current = {
      events, evIdx: 0, notes, marks, beats: beats.sort((a, b) => a - b), beatIdx: 0,
      startT, endT: t + 0.5, points: 0, strays: 0, combo: 0, maxCombo: 0,
      counts: { perfect: 0, good: 0, ok: 0, miss: 0 },
      pulse: 0, ringPulse: 0, flashCol: "#ffffff", ringEase: -1, fx: [], done: false,
    };
    setHud({ track: marks[0].label, bpm: marks[0].bpm, combo: 0, pts: 0 });
    setFinal(null);
    setPhase("play");
  };

  /* ---------- audio scheduler + game loop ---------- */
  useEffect(() => {
    if (phase !== "play") return;
    const c = audio();
    const r = run.current!;
    const accent = readAccent();

    const scheduler = window.setInterval(() => {
      const horizon = c.currentTime + 0.15;
      while (r.evIdx < r.events.length && r.events[r.evIdx].t < horizon) {
        const ev = r.events[r.evIdx++];
        if (ev.type === "kick") kick(ev.t);
        else if (ev.type === "snare") snare(ev.t);
        else if (ev.type === "hat") hat(ev.t);
        else if (ev.type === "open") hat(ev.t, true);
        else {
          click(ev.t, true, ev.f);
        }
      }
    }, 25);

    const cv = canvasRef.current!;
    const g2 = cv.getContext("2d")!;
    const resize = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; };
    resize();
    addEventListener("resize", resize);

    let raf = 0;
    let lastHudTrack = "";
    let lastHudCombo = -1;
    let lastHudPts = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const nowT = c.currentTime;
      const W = cv.width, H = cv.height;
      /* lane geometry per format — every format keeps one truth:
         a note sits exactly on the hit ring at its moment. */
      let hitX: number, laneY: number;
      if (lane === "curve") {
        hitX = W * (0.2 + 0.05 * Math.sin(nowT * 0.13));
        laneY = H * (0.56 + 0.07 * Math.sin(nowT * 0.17 + 2.1));
      } else if (lane === "orbit") {
        hitX = W * (0.5 + 0.03 * Math.sin(nowT * 0.15));
        laneY = H * (0.5 + 0.04 * Math.sin(nowT * 0.12 + 1));
      } else {
        /* rain: the ring glides along the floor to meet the next drop */
        const nxt = r.notes.find((n) => n.state === "pending" && n.t - nowT > -W_OK);
        const targetX = nxt ? rainX(nxt, W) : W / 2;
        r.ringEase = r.ringEase < 0 ? targetX : r.ringEase + (targetX - r.ringEase) * 0.16;
        hitX = r.ringEase;
        laneY = H * (0.74 + 0.015 * Math.sin(nowT * 0.2));
      }
      const vpX = W * (0.84 + 0.04 * Math.sin(nowT * 0.11 + 1.2));
      const vpY = H * (0.26 + 0.09 * Math.sin(nowT * 0.19 + 4.2));
      const orbitR = Math.min(W, H) * 0.47;

      /* judge overdue notes as misses */
      for (const n of r.notes) {
        if (n.state === "pending" && nowT - n.t > W_OK) {
          n.state = "miss";
          n.value = 0;
          r.counts.miss++;
          r.combo = 0;
        }
        if (n.t > nowT + APPROACH) break;
      }

      /* beat pulse */
      while (r.beatIdx < r.beats.length && r.beats[r.beatIdx] <= nowT) { r.pulse = 1; r.beatIdx++; }
      r.pulse *= 0.94;
      r.ringPulse *= 0.9;

      /* hud — only touch React state when something changed */
      const mark = r.marks.find((m) => nowT < m.to + 0.8);
      /* same scale as runScore, over the notes resolved so far, so it converges
         exactly on the final score instead of running on its own scale */
      const resolved = r.counts.perfect + r.counts.good + r.counts.ok + r.counts.miss;
      const pts = Math.round(Math.max(0, ((r.points - r.strays * 0.15) / Math.max(1, resolved)) * 100) * 10) / 10;
      if (mark && (mark.label !== lastHudTrack || r.combo !== lastHudCombo || pts !== lastHudPts)) {
        lastHudTrack = mark.label;
        lastHudCombo = r.combo;
        lastHudPts = pts;
        setHud({ track: mark.label, bpm: mark.bpm, combo: r.combo, pts });
      }

      /* ---- draw ---- */
      g2.clearRect(0, 0, W, H);

      const ti = mark ? r.marks.indexOf(mark) : r.marks.length - 1;
      const trackCol = TRACK_COLS[Math.max(0, ti) % TRACK_COLS.length];

      /* beat-lit glow behind the ring in the track's color */
      const glow = g2.createRadialGradient(hitX, laneY, 0, hitX, laneY, H * 0.6);
      glow.addColorStop(0, rgbaHex(trackCol, 0.03 + r.pulse * 0.09));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      g2.fillStyle = glow;
      g2.fillRect(0, 0, W, H);

      /* the lane itself, per format */
      let bez: ((u: number) => { x: number; y: number }) | null = null;
      if (lane === "curve") {
        /* a living curve: its bow drifts with time and jumps on the
           beat; notes ride it, so it converges exactly on the ring */
        const dxv = vpX - hitX, dyv = vpY - laneY;
        const dlen = Math.hypot(dxv, dyv) || 1;
        const pxn = -dyv / dlen, pyn = dxv / dlen;
        const bow =
          (Math.sin(nowT * 0.85) * 0.05 + Math.sin(nowT * 0.31 + 1.7) * 0.03) * H +
          r.pulse * H * 0.02;
        const cxb = (hitX + vpX) / 2 + pxn * bow;
        const cyb = (laneY + vpY) / 2 + pyn * bow;
        bez = (u: number) => {
          const v = 1 - u;
          return {
            x: v * v * hitX + 2 * v * u * cxb + u * u * vpX,
            y: v * v * laneY + 2 * v * u * cyb + u * u * vpY,
          };
        };
        g2.strokeStyle = "rgba(239,240,244,.12)";
        g2.lineWidth = (1.5 + r.pulse * 1.4) * devicePixelRatio;
        g2.beginPath();
        for (let i = 0; i <= 28; i++) {
          const q = bez(i / 28);
          if (i) g2.lineTo(q.x, q.y); else g2.moveTo(q.x, q.y);
        }
        g2.stroke();
        for (let d = 1; d <= 4; d++) {
          const pq = bez(d / 5);
          g2.strokeStyle = "rgba(239,240,244,.08)";
          g2.beginPath();
          g2.arc(pq.x, pq.y, 32 * devicePixelRatio * (1 - (d / 5) * 0.7), 0, Math.PI * 2);
          g2.stroke();
        }
      } else if (lane === "orbit") {
        /* concentric orbit guides, breathing on the beat */
        for (let d = 1; d <= 3; d++) {
          g2.strokeStyle = `rgba(239,240,244,${0.05 + r.pulse * 0.04})`;
          g2.lineWidth = 1.5 * devicePixelRatio;
          g2.beginPath();
          g2.ellipse(hitX, laneY, orbitR * (d / 3), orbitR * 0.72 * (d / 3), 0, 0, Math.PI * 2);
          g2.stroke();
        }
      } else {
        /* rain floor */
        g2.strokeStyle = `rgba(239,240,244,${0.1 + r.pulse * 0.08})`;
        g2.lineWidth = (1.5 + r.pulse * 1.2) * devicePixelRatio;
        g2.beginPath(); g2.moveTo(0, laneY); g2.lineTo(W, laneY); g2.stroke();
      }

      /* one timing circle only: the perfect window, floored so it always
         reads clearly inside the hit ring — land a rock in it for a perfect */
      const ppOf = (dtv: number) => { const uu = dtv / APPROACH; return (uu * 1.35) / (uu + 0.35); };
      const laneDist = (ppv: number) => {
        if (lane === "curve") { const q = bez!(ppv); return Math.hypot(q.x - hitX, q.y - laneY); }
        if (lane === "orbit") return orbitR * 0.86 * ppv;
        return laneY * 0.92 * ppv;
      };
      const perfR = Math.max(laneDist(ppOf(W_PERFECT)), 30 * devicePixelRatio);
      /* the perfect-hit ring, in the game's colour — a white flash still means
         you nailed one, so only the resting ring is tinted */
      g2.fillStyle = shade(accent, 60, 0.07);
      g2.beginPath(); g2.arc(hitX, laneY, perfR, 0, Math.PI * 2); g2.fill();
      g2.strokeStyle = shade(accent, 68, 0.8);
      g2.lineWidth = 1.5 * devicePixelRatio;
      g2.beginPath(); g2.arc(hitX, laneY, perfR, 0, Math.PI * 2); g2.stroke();

      /* hit ring flashes the color of whatever you just hit */
      const ringR = (42 + r.ringPulse * 14) * devicePixelRatio;
      g2.strokeStyle = r.ringPulse > 0.04
        ? mixHex("#f0f0f4", r.flashCol, Math.min(1, r.ringPulse * 1.2))
        : `rgba(240,240,244,${0.7 + r.pulse * 0.3})`;
      g2.lineWidth = 3 * devicePixelRatio;
      g2.beginPath(); g2.arc(hitX, laneY, ringR, 0, Math.PI * 2); g2.stroke();

      const dpr = devicePixelRatio;
      for (const n of r.notes) {
        const dt = n.t - nowT;
        if (dt > APPROACH) break;
        if (dt < -1.0) continue;
        const u = Math.max(0, dt / APPROACH);
        const pp = (u * 1.35) / (u + 0.35);          // perspective curve: fast far away, precise up close
        /* where this rock sits at a given lane position */
        const posAt = (ppv: number): { x: number; y: number } => {
          if (lane === "curve") {
            const q = bez!(ppv);
            return { x: q.x, y: q.y + Math.sin(nowT * 1.8 + n.t * 2.3) * H * 0.03 * ppv };
          }
          if (lane === "orbit") {
            const th = n.t * 1.7 + nowT * 0.6 + ppv * 5;   // spiral in toward the center ring
            return { x: hitX + Math.cos(th) * orbitR * ppv, y: laneY + Math.sin(th) * orbitR * 0.72 * ppv };
          }
          return {                                        // fall down its own column, light shimmy
            x: rainX(n, W) + Math.sin(nowT * 2 + n.t * 3) * 10 * dpr * ppv,
            y: laneY - ppv * laneY * 0.92,
          };
        };
        const { x, y } = posAt(pp);
        const depth = 1 - pp * (lane === "curve" ? 0.7 : 0.5);
        const rad = (n.kind === "kick" ? 22 : 17) * dpr * depth;
        const fade = 0.35 + 0.65 * (1 - pp);
        const col = n.kind === "kick" ? KICK_COL : SNARE_COL;
        const seed = (n.t * 7.13) % 1;
        const rot = nowT * (0.6 + seed) * (seed > 0.5 ? 1 : -1);

        if (n.state === "hit") {
          if (n.hx === undefined) {   // first frame after the tap: decide how it dies
            n.hx = x; n.hy = y; n.hitT = nowT;
            if (n.value >= 1) spawnBurst(r.fx, x, y, nowT, "#ffffff", 36, W * 0.38, 6 * dpr, true);
            else if (n.value >= 0.6) spawnBurst(r.fx, x, y, nowT, col, 18, W * 0.26, 4.5 * dpr, false);
            else {                    // sloppy: ricochet off the ring
              const ang = Math.atan2(y - laneY, x - hitX) + (seed - 0.5) * 1.2;
              n.dvx = Math.cos(ang) * W * 0.45;
              n.dvy = Math.sin(ang) * W * 0.45 - H * 0.25;
              spawnBurst(r.fx, x, y, nowT, col, 6, W * 0.14, 3 * dpr, false);
            }
          }
          if (n.dvx !== undefined) {  // deflected rock tumbling away under gravity
            const age = nowT - (n.hitT ?? nowT);
            const al = Math.max(0, 1 - age / 0.9);
            if (al > 0) {
              const dx = n.hx! + n.dvx * age;
              const dy = n.hy! + n.dvy! * age + H * 0.55 * age * age;
              drawAsteroid(g2, dx, dy, rad, seed, rot * 4,
                n.kind === "kick" ? rgbaHex(col, al * 0.9) : null, rgbaHex(col, al), dpr);
            }
          }
          continue;
        }

        if (n.state === "miss") {
          /* sails straight through the ring and off along its heading */
          let mx = x, my = y;
          if (dt < 0) {
            const p0 = posAt(0), p1 = posAt(0.08);
            const len = Math.hypot(p0.x - p1.x, p0.y - p1.y) || 1;
            mx = p0.x + ((p0.x - p1.x) / len) * -dt * W * 0.35;
            my = p0.y + ((p0.y - p1.y) / len) * -dt * W * 0.35;
          }
          const al = fade * (dt < 0 ? Math.max(0, 1 + dt / 0.9) : 1);
          drawAsteroid(g2, mx, my, rad, seed, rot,
            n.kind === "kick" ? `rgba(120,120,128,${al * 0.6})` : null, `rgba(150,150,158,${al})`, dpr);
          continue;
        }

        /* pending: grey in the distance, blooming into its color as it nears */
        const near = Math.max(0, 1 - Math.abs(dt) / 0.5);
        const body = mixHex("#8f8f97", col, Math.min(1, (1 - pp) * 0.6 + near * 0.5), 0.95 * fade);
        const edge = mixHex("#d8d8de", col, Math.min(1, (1 - pp) * 0.6 + near * 0.5), 0.95 * fade);
        drawAsteroid(g2, x, y, rad, seed, rot, n.kind === "kick" ? body : null, n.kind === "kick" ? edge : body, dpr);
      }

      /* explosions, sparks, and the white flash of a perfect */
      r.fx = r.fx.filter((p) => nowT - p.born < p.life);
      for (const p of r.fx) {
        const age = nowT - p.born, k = age / p.life;
        if (p.kind === "flash") {
          g2.fillStyle = `rgba(255,255,255,${(1 - k) * 0.16})`;
          g2.fillRect(0, 0, W, H);
          const rr = p.size * 3 + k * W * 0.14;
          g2.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.9})`;
          g2.lineWidth = 5 * dpr * (1 - k) + 0.5;
          g2.beginPath(); g2.arc(p.x, p.y, rr, 0, Math.PI * 2); g2.stroke();
          g2.fillStyle = `rgba(255,255,255,${(1 - k) * 0.4})`;
          g2.beginPath(); g2.arc(p.x, p.y, rr * 0.55, 0, Math.PI * 2); g2.fill();
        } else {
          const px = p.x + p.vx * age, py = p.y + p.vy * age + H * 0.35 * age * age;
          const s = p.size * (1 - k * 0.5);
          g2.fillStyle = rgbaHex(p.col, 1 - k);
          g2.fillRect(px - s / 2, py - s / 2, s, s);
        }
      }

      /* progress: one solid segment per track along the top edge */
      const gap = 6 * devicePixelRatio, barH = 4 * devicePixelRatio;
      const durAll = r.marks.reduce((s, m) => s + (m.to - m.from), 0) || 1;
      const totalW = W - gap * (r.marks.length + 1);
      let bx = gap;
      r.marks.forEach((m, i) => {
        const w = totalW * ((m.to - m.from) / durAll);
        g2.fillStyle = "rgba(239,240,244,.10)";
        g2.fillRect(bx, 0, w, barH);
        const frac = Math.max(0, Math.min(1, (nowT - m.from) / (m.to - m.from)));
        if (frac > 0) {
          g2.fillStyle = TRACK_COLS[i % TRACK_COLS.length];
          g2.fillRect(bx, 0, w * frac, barH);
        }
        bx += w + gap;
      });

      /* finished? */
      if (nowT > r.endT && !r.done) {
        r.done = true;
        const total = runScore(r);
        const key = scoreKey("tempo", diff);
        const rounded = Math.round(total * 10) / 10;
        const isRecord = rounded > getBest(key) && rounded > 0;
        if (isRecord) setBest(key, rounded);
        setRecord(isRecord);
        recordPlay("tempo");
          /* Put it on the shared board, if this was the daily and there is
             somewhere to put it. Failure is silent: the score is already safe
             locally, and a leaderboard is never worth interrupting a game for. */
          {
            const seed = seedRef.current;
            const token = readToken();
            if (seed !== null && token) {
              submitScore(token, {
                mode: `tempo-${diff}`,
                period: todayStamp(),
                seed,
                score: Math.round(total * 10),
                proof: { counts: { perfect: r.counts.perfect, good: r.counts.good, ok: r.counts.ok, strays: r.strays } },
              })
                .then((posted) => setRank(posted?.rank ?? null))
                .catch(() => {});
            }
          }
        setRunStamp(Date.now());
        setFinal({ ...r });
        setPhase("results");
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      clearInterval(scheduler);
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    };
  }, [phase, diff, lane]);

  /* ---------- input ---------- */
  const judgeId = useRef(0);
  const tap = () => {
    if (phase !== "play" || !run.current) return;
    const c = audio();
    /* players react to what they HEAR — on Bluetooth that lags the
       clock, so judge against the perceived time, not the raw one */
    const latency = c.outputLatency || c.baseLatency || 0;
    const j = applyTap(run.current, c.currentTime - latency);
    uiBlip(j.blip, 0.055, 0.09);
    setJudge({ text: j.text, id: ++judgeId.current, color: j.color });
  };

  useEffect(() => {
    if (phase !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); tap(); }
      if (e.key === "Escape" && !document.fullscreenElement) { e.preventDefault(); setPhase("menu"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (phase !== "results") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) { e.preventDefault(); setPhase("menu"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  /* ---------- render ---------- */
  return (
    <>
      <canvas ref={canvasRef} className="fullCanvas" aria-hidden />

      {phase === "board" && (
        <Leaderboard mode={`tempo-${diff}`} title="Downbeat"
          metric="Accuracy" unit="%" onClose={() => setPhase("menu")} />
      )}
      {phase === "menu" && (
        <main className="stage menuStage">
          <Stagger style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <Item><h1 className="wordmark">Downbeat</h1></Item>
            <Item><GameMark game="tempo" className="gameMark" /></Item>
            <Item>
              <p className="tagline">
                A beat rolls and asteroids tumble in toward the ring. Tap when one touches it.
                Solid rocks are kicks, hollow ones are snares. Perfect hits explode white.
                Sloppy ones bounce off. Misses just keep going.
              </p>
            </Item>
            <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <GameSetup game="tempo" diffs={DIFFS} diff={diff}
              daily={daily === "on"}
              onDaily={(on) => setDaily(on ? "on" : "off")}
              dayNumber={dayNumber()}
                onDiff={setDiff} onStart={start} refreshToken={runStamp}
                beats={TRACKS_UI} beat={trackPick} onBeat={setTrackPick}
                formats={LANES_UI} format={lane} formatsPrimary formatsLabel="Game type"
                onFormat={(k) => setLane(k as LaneStyle)}
                sounds={KITS_UI} sound={kit}
                onSound={(k) => {
                  const name = k as DrumKitName;
                  setKit(name);
                  setDrumKit(name);
                  const t = audio().currentTime + 0.02;   // quick kit preview
                  kick(t); hat(t + 0.13); snare(t + 0.26);
                }}
                helpContent={{
                  title: "Downbeat",
                  description: "Rocks drift in on the beat and you blow them up at the ring, not before it.",
                  steps: [
                    "Let the loop run a bar first. Get the pulse into your hands.",
                    "Tap the moment a rock touches the ring.",
                    "White means you nailed it. Early, late and missed all cost you.",
                  ],
                }} />
            </Item>
          </Stagger>
          <div className="hint">Tap · click · or spacebar</div>
        </main>
      )}

      {phase === "play" && (
        <main className="stage" style={{ cursor: "pointer" }} onPointerDown={tap}>
          <div className="tempoHud">
            <span><b>{hud.track}</b></span>
            <span><b>{hud.bpm}</b> BPM</span>
            <span>combo <b>{hud.combo}</b></span>
            <span><b>{hud.pts.toFixed(1)}</b> / 100</span>
          </div>
          {judge && (
            <div key={judge.id} className="judge pop" style={{ color: judge.color }}>
              {judge.text}
            </div>
          )}
          <div className="kbd tapHint" style={{ position: "absolute" }}>
            <span><b>Tap</b>anywhere</span><span><b>Space</b>taps too</span><span><b>Esc</b>menu</span>
          </div>
        </main>
      )}

      {phase === "results" && final && (() => {
        const total = runScore(final);
        const verdict =
          total >= 90 ? "Metronome." :
          total >= 75 ? "In the pocket." :
          total >= 55 ? "Solid groove." :
          total >= 35 ? "Rushing a little." : "Timing is a suggestion.";
        const best = getBest(scoreKey("tempo", diff));
        return (
          <main className="stage resStage">
            {record && <Celebrate />}
            <Pop className="resHead">
              <h2 className="resVerdict">{verdict}</h2>
              <div className="resTotal">
                <b>{total.toFixed(1)} / 100</b> · {diff}
                {best > 0 && ` · best ${best.toFixed(1)}`}
              </div>
            </Pop>
            <Stagger className="statRow" delay={0.1}>
              <Item className="stat"><b>{final.counts.perfect}</b><span>perfect</span></Item>
              <Item className="stat"><b>{final.counts.good}</b><span>good</span></Item>
              <Item className="stat"><b>{final.counts.ok}</b><span>off</span></Item>
              <Item className="stat"><b>{final.counts.miss}</b><span>missed</span></Item>
              <Item className="stat"><b>{final.strays}</b><span>stray taps</span></Item>
              <Item className="stat"><b>{final.maxCombo}</b><span>max combo</span></Item>
            </Stagger>
            <div className="resActions">
              <button className="cta" data-note={440} onClick={start}>Play again</button>
              <ShareScore
                game="Downbeat"
                route="tempo"
                detail={`${diff} · ${kit}/${lane}`}
                line={`${total.toFixed(1)} / 100 ${barEmoji(total)} · ${final.maxCombo} combo`}
                level={diff}
              />
        {/* Where this run landed, or the offer to put it there. Only ever for
            the daily, which is the only ranked run. */}
        {rank !== null ? (
          <p className="rankLine">
            <b>#{rank}</b> on today&rsquo;s Downbeat board{" "}
            <button className="linkish" onClick={() => setPhase("board")}>See the board</button>
          </p>
        ) : rankedRun && !signedIn ? (
          <button className="ghost" data-note={523} onClick={() => signIn()}>
            Put this score on the daily board
          </button>
        ) : null}
              <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Options</button>
            </div>
          </main>
        );
      })()}
    </>
  );
}
