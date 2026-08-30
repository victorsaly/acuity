"use client";

import { useEffect, useRef, useState } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import ShareScore from "@/components/ShareScore";
import Celebrate from "@/components/Celebrate";
import { Stagger, Item, Pop } from "@/components/Fx";
import { audio, kick, snare, hat, click, uiBlip, setDrumKit, preloadAllKits, type DrumKitName } from "@/lib/audio";
import { getBest, setBest, scoreKey, rngFor, usePref, todayStamp, recordPlay, type Mode } from "@/lib/store";
import { scoreCard, barEmoji } from "@/lib/share";

type Phase = "menu" | "play" | "results";

const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "1 track", note: 523 },
  { key: "medium", label: "Medium", sub: "1 track+", note: 587 },
  { key: "hard", label: "Hard", sub: "2 tracks", note: 659 },
  { key: "brutal", label: "Brutal", sub: "3 tracks", note: 784 },
];

/* 16-step bar patterns. Player taps every kick + snare. */
type Pattern = { kick: number[]; snare: number[]; hat: number[]; open?: number[] };
const PATTERNS: Record<string, Pattern> = {
  basic: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  boomBap: { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  gFunk: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [10] },
  club: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
  breaks: { kick: [0, 3, 6, 10], snare: [4, 12, 15], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [7] },
};
const DIFF_CFG: Record<string, { tracks: { p: string; bars: number }[]; bpm: [number, number] }> = {
  easy: { tracks: [{ p: "basic", bars: 8 }], bpm: [76, 96] },
  medium: { tracks: [{ p: "boomBap", bars: 10 }], bpm: [88, 108] },
  hard: { tracks: [{ p: "gFunk", bars: 8 }, { p: "club", bars: 8 }], bpm: [96, 126] },
  brutal: { tracks: [{ p: "boomBap", bars: 8 }, { p: "breaks", bars: 8 }, { p: "club", bars: 8 }], bpm: [108, 140] },
};

const APPROACH = 1.8;               // seconds a note is on screen before the ring
const W_PERFECT = 0.05, W_GOOD = 0.1, W_OK = 0.15;

/* the only color in the app lives here, on the beat: solid, distinct hues */
const KICK_COL = "#3dc9ff";                       // kicks: cyan
const SNARE_COL = "#ff5f9e";                      // snares: magenta
const TRACK_COLS = ["#3dc9ff", "#ffb454", "#a4ff4f"]; // per-track progress colors

const KITS_UI = [
  { key: "punch", label: "Punch" },
  { key: "boom", label: "Boom" },
  { key: "club", label: "Club" },
  { key: "wood", label: "Wood" },
];

type LaneStyle = "curve" | "orbit" | "rain";
const LANES_UI = [
  { key: "curve", label: "Curve" },
  { key: "orbit", label: "Orbit" },
  { key: "rain", label: "Rain" },
];
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

/** Every note is a little face: mouth opens as it nears the ring,
    grins the instant you hit it, sulks if you let it pass. */
function drawFace(
  g2: CanvasRenderingContext2D, x: number, y: number, rad: number,
  state: "pending" | "hit" | "miss", mouthOpen: number, col: string, dpr: number,
) {
  if (rad < 7 * dpr) return;
  g2.strokeStyle = col;
  g2.fillStyle = col;
  g2.lineWidth = Math.max(1, rad * 0.1);
  g2.lineCap = "round";
  const ex = rad * 0.34, ey = rad * 0.22, er = Math.max(1, rad * 0.09);
  if (state === "hit") {
    for (const s of [-1, 1]) {   // happy closed eyes ^ ^
      g2.beginPath();
      g2.arc(x + s * ex, y - ey + er * 1.4, er * 1.7, Math.PI * 1.15, Math.PI * 1.85);
      g2.stroke();
    }
    g2.beginPath();              // big grin
    g2.arc(x, y + rad * 0.02, rad * 0.44, Math.PI * 0.15, Math.PI * 0.85);
    g2.stroke();
  } else if (state === "miss") {
    for (const s of [-1, 1]) {
      g2.beginPath(); g2.arc(x + s * ex, y - ey, er, 0, Math.PI * 2); g2.fill();
    }
    g2.beginPath();              // frown
    g2.arc(x, y + rad * 0.66, rad * 0.36, Math.PI * 1.15, Math.PI * 1.85);
    g2.stroke();
  } else {
    for (const s of [-1, 1]) {
      g2.beginPath(); g2.arc(x + s * ex, y - ey, er, 0, Math.PI * 2); g2.fill();
    }
    g2.beginPath();              // "o" mouth, opening with anticipation
    g2.arc(x, y + rad * 0.3, Math.max(1, rad * (0.08 + mouthOpen * 0.2)), 0, Math.PI * 2);
    g2.stroke();
  }
}

type Ev = { t: number; type: "kick" | "snare" | "hat" | "open" | "click"; f?: number };
type Note = { t: number; kind: "kick" | "snare"; state: "pending" | "hit" | "miss"; value: number };
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
    j = { text: bestDt < 0 ? "early" : "late", color: "#8a8a92", blip: 523 };
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
  done: boolean;
};

export default function TempoGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = usePref("tempo-diff", "medium");
  const [modeStr, setMode] = usePref("tempo-mode", "free");
  const mode = modeStr as Mode;
  const [kitStr, setKit] = usePref("tempo-kit", "punch");
  const kit = kitStr as DrumKitName;
  const [laneStr, setLane] = usePref("tempo-lane", "curve");
  const lane = laneStr as LaneStyle;
  const [runStamp, setRunStamp] = useState(0);
  const [hud, setHud] = useState({ track: "", bpm: 0, combo: 0, pts: 0 });
  const [judge, setJudge] = useState<{ text: string; id: number; color: string } | null>(null);
  const [final, setFinal] = useState<Run | null>(null);
  const [record, setRecord] = useState(false);

  const run = useRef<Run | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { preloadAllKits(); }, []);   // sampled kits fetch in the background; synth covers until then

  /* ---------- build the whole timeline up front ---------- */
  const start = () => {
    const c = audio();
    setDrumKit(kit);   // remembered preference may not have touched the engine yet
    const rng = rngFor(mode, "tempo", diff);
    const cfg = DIFF_CFG[diff];
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
      marks.push({ from, to: t, label: `Track ${ti + 1}/${cfg.tracks.length}`, bpm });
      t += 1.1; // breather between tracks
    });

    events.sort((a, b) => a.t - b.t);
    notes.sort((a, b) => a.t - b.t);

    run.current = {
      events, evIdx: 0, notes, marks, beats: beats.sort((a, b) => a - b), beatIdx: 0,
      startT, endT: t + 0.5, points: 0, strays: 0, combo: 0, maxCombo: 0,
      counts: { perfect: 0, good: 0, ok: 0, miss: 0 },
      pulse: 0, ringPulse: 0, flashCol: "#ffffff", ringEase: -1, done: false,
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

    const scheduler = window.setInterval(() => {
      const horizon = c.currentTime + 0.15;
      while (r.evIdx < r.events.length && r.events[r.evIdx].t < horizon) {
        const ev = r.events[r.evIdx++];
        if (ev.type === "kick") kick(ev.t);
        else if (ev.type === "snare") snare(ev.t);
        else if (ev.type === "hat") hat(ev.t);
        else if (ev.type === "open") hat(ev.t, true);
        else click(ev.t, true, ev.f);
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
      const pts = Math.round(Math.max(0, r.points * 10 - r.strays * 1.5) * 10) / 10;
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

      /* hit ring flashes the color of whatever you just hit */
      const ringR = (42 + r.ringPulse * 14) * devicePixelRatio;
      g2.strokeStyle = r.ringPulse > 0.04
        ? mixHex("#f0f0f4", r.flashCol, Math.min(1, r.ringPulse * 1.2))
        : `rgba(240,240,244,${0.7 + r.pulse * 0.3})`;
      g2.lineWidth = 3 * devicePixelRatio;
      g2.beginPath(); g2.arc(hitX, laneY, ringR, 0, Math.PI * 2); g2.stroke();

      for (const n of r.notes) {
        const dt = n.t - nowT;
        if (dt > APPROACH) break;
        if (dt < -0.25) continue;
        const u = Math.max(0, dt / APPROACH);
        const pp = (u * 1.35) / (u + 0.35);          // perspective curve: fast far away, precise up close
        let x: number, y: number;
        if (lane === "curve") {
          const q = bez!(pp);
          x = q.x;
          y = q.y + Math.sin(nowT * 1.8 + n.t * 2.3) * H * 0.03 * pp;
        } else if (lane === "orbit") {
          /* spiral in toward the center ring */
          const th = n.t * 1.7 + nowT * 0.6 + pp * 5;
          x = hitX + Math.cos(th) * orbitR * pp;
          y = laneY + Math.sin(th) * orbitR * 0.72 * pp;
        } else {
          /* fall straight down its own column, with a light shimmy */
          x = rainX(n, W) + Math.sin(nowT * 2 + n.t * 3) * 10 * devicePixelRatio * pp;
          y = laneY - pp * laneY * 0.92;
        }
        const depth = 1 - pp * (lane === "curve" ? 0.7 : 0.5);
        const rad = (n.kind === "kick" ? 22 : 17) * devicePixelRatio * depth;
        const fade = 0.35 + 0.65 * (1 - pp);
        const col = n.kind === "kick" ? KICK_COL : SNARE_COL;
        if (n.state === "hit") {
          g2.strokeStyle = rgbaHex(col, 0.55 * fade);
          g2.lineWidth = 2 * devicePixelRatio;
          g2.beginPath(); g2.arc(x, y, rad * 1.35, 0, Math.PI * 2); g2.stroke();
          drawFace(g2, x, y, rad * 1.15, "hit", 0, rgbaHex(col, 0.85 * fade), devicePixelRatio);
        } else if (n.state === "miss") {
          g2.fillStyle = "rgba(110,110,118,.3)";
          g2.beginPath(); g2.arc(x, y, rad, 0, Math.PI * 2); g2.fill();
          drawFace(g2, x, y, rad, "miss", 0, "rgba(160,160,168,.55)", devicePixelRatio);
        } else {
          /* far away: grey; blooms into its own color as it approaches */
          const near = Math.max(0, 1 - Math.abs(dt) / 0.5);
          const body = mixHex("#8f8f97", col, Math.min(1, (1 - pp) * 0.6 + near * 0.5), 0.95 * fade);
          if (n.kind === "kick") {
            g2.fillStyle = body;
            g2.beginPath(); g2.arc(x, y, rad, 0, Math.PI * 2); g2.fill();
            drawFace(g2, x, y, rad, "pending", near, "rgba(12,13,18,.85)", devicePixelRatio);
          } else {
            g2.strokeStyle = body;
            g2.lineWidth = 3 * devicePixelRatio * Math.max(0.5, depth);
            g2.beginPath(); g2.arc(x, y, rad, 0, Math.PI * 2); g2.stroke();
            drawFace(g2, x, y, rad, "pending", near, body, devicePixelRatio);
          }
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
        const key = scoreKey("tempo", mode, diff);
        const isRecord = total > getBest(key) && total > 0;
        if (isRecord) setBest(key, Math.round(total * 10) / 10);
        setRecord(isRecord);
        recordPlay("tempo");
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
  }, [phase, diff, mode, lane]);

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
      if (e.key === "Escape" && !document.fullscreenElement) setPhase("menu");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (phase !== "results") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setPhase("menu");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  /* ---------- render ---------- */
  return (
    <>
      <canvas ref={canvasRef} className="fullCanvas" aria-hidden />

      {phase === "menu" && (
        <main className="stage menuStage">
          <Stagger style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <Item><h1 className="wordmark">Downbeat</h1></Item>
            <Item>
              <p className="tagline">
                A beat rolls and notes ride a living curve out of the deep. Tap them dead on time —
                filled cyan notes are kicks, hollow magenta ones are snares.
              </p>
            </Item>
            <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <GameSetup game="tempo" diffs={DIFFS} diff={diff} mode={mode}
                onDiff={setDiff} onMode={setMode} onStart={start} refreshToken={runStamp}
                formats={LANES_UI} format={lane}
                onFormat={(k) => setLane(k as LaneStyle)}
                sounds={KITS_UI} sound={kit}
                onSound={(k) => {
                  const name = k as DrumKitName;
                  setKit(name);
                  setDrumKit(name);
                  const t = audio().currentTime + 0.02;   // quick kit preview
                  kick(t); hat(t + 0.13); snare(t + 0.26);
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
            <span><b>{hud.pts.toFixed(1)}</b> pts</span>
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
        const best = getBest(scoreKey("tempo", mode, diff));
        return (
          <main className="stage resStage">
            {record && <Celebrate />}
            <Pop className="resHead">
              <h2 className="resVerdict">{verdict}</h2>
              <div className="resTotal">
                <b>{total.toFixed(1)} / 100</b> · {mode} · {diff}
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
              <ShareScore text={scoreCard(
                "Downbeat",
                `${diff} · ${kit}/${lane}${mode === "daily" ? ` · daily ${todayStamp()}` : ""}`,
                `${total.toFixed(1)}/100 ${barEmoji(total)} · ${final.maxCombo} combo`,
              )} />
              <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Options</button>
            </div>
          </main>
        );
      })()}
    </>
  );
}
