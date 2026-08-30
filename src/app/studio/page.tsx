"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Item, Stagger } from "@/components/Fx";
import {
  audio, unlockAudio, bass, clap, hat, kick, perc, rim, snare, stab, uiBlip,
  setDrumKit, preloadAllKits, loadLabSamples, labPlay, outputStream,
  type DrumKitName, type LeadVoice, type LabSound,
} from "@/lib/audio";
import styles from "./page.module.css";

/* ============================== musical data ==============================
 * The harmonic guardrails: every progression is diatonic to the chosen minor
 * key, the bass always follows the chord root, and the melody is minor
 * pentatonic — so any pick-and-mix combination stays consonant.  ElevenLabs
 * chops and FX are kept in atonal roles where a sample can't clash.
 */

type Genre = "rap" | "rnb" | "house";
type AccStyle = CSSProperties & { "--acc": string };

const KEYS = [
  { label: "F", semi: 0 }, { label: "G", semi: 2 }, { label: "A", semi: 4 },
  { label: "B♭", semi: 5 }, { label: "C", semi: 7 }, { label: "D", semi: 9 },
];

/* chord qualities as semitone intervals above the root */
const m = [0, 3, 7], M = [0, 4, 7], m7 = [0, 3, 7, 10], M7 = [0, 4, 7, 11],
  m9 = [0, 3, 7, 10, 14], dom = [0, 4, 7, 10];

type Prog = { label: string; roman: string[]; bars: { deg: number; iv: number[] }[] };
const PROGS: Record<string, Prog> = {
  menace:     { label: "Menace",      roman: ["i", "VI", "III", "VII"], bars: [{ deg: 0, iv: m7 }, { deg: 8, iv: M7 }, { deg: 3, iv: M7 }, { deg: 10, iv: dom }] },
  cypher:     { label: "Cypher",      roman: ["i", "iv", "i", "v"],     bars: [{ deg: 0, iv: m7 }, { deg: 5, iv: m7 }, { deg: 0, iv: m7 }, { deg: 7, iv: m7 }] },
  soulflip:   { label: "Soul Flip",   roman: ["i", "III", "VI", "VII"], bars: [{ deg: 0, iv: m9 }, { deg: 3, iv: M7 }, { deg: 8, iv: M7 }, { deg: 10, iv: dom }] },
  silk:       { label: "Silk",        roman: ["i", "VI", "iv", "VII"],  bars: [{ deg: 0, iv: m9 }, { deg: 8, iv: M7 }, { deg: 5, iv: m9 }, { deg: 10, iv: dom }] },
  latenight:  { label: "Late Night",  roman: ["i", "iv", "VI", "v"],    bars: [{ deg: 0, iv: m9 }, { deg: 5, iv: m7 }, { deg: 8, iv: M7 }, { deg: 7, iv: m7 }] },
  heartbreak: { label: "Heartbreak",  roman: ["VI", "VII", "i", "i"],   bars: [{ deg: 8, iv: M7 }, { deg: 10, iv: M }, { deg: 0, iv: m9 }, { deg: 0, iv: m9 }] },
  pianohouse: { label: "Piano House", roman: ["i", "VII", "VI", "VII"], bars: [{ deg: 0, iv: m }, { deg: 10, iv: M }, { deg: 8, iv: M7 }, { deg: 10, iv: M }] },
  warehouse:  { label: "Warehouse",   roman: ["i", "i", "i", "i"],      bars: [{ deg: 0, iv: m7 }, { deg: 0, iv: m7 }, { deg: 0, iv: m7 }, { deg: 0, iv: m7 }] },
  euphoria:   { label: "Euphoria",    roman: ["III", "VII", "i", "VI"], bars: [{ deg: 3, iv: M }, { deg: 10, iv: M }, { deg: 0, iv: m }, { deg: 8, iv: M7 }] },
};

/* bass patterns: [step, semitones above chord root, volume] per bar */
type BassPat = { label: string; steps: [number, number, number][] };
const BASS: Record<string, BassPat> = {
  hold:    { label: "Sub Hold",  steps: [[0, 0, 0.95]] },
  boombap: { label: "Boom Bap",  steps: [[0, 0, 0.95], [7, 0, 0.6], [10, 0, 0.8]] },
  bounce:  { label: "Bounce",    steps: [[0, 0, 0.95], [3, 12, 0.5], [8, 0, 0.85], [11, 12, 0.5]] },
  slowjam: { label: "Slow Jam",  steps: [[0, 0, 0.9], [10, 7, 0.5], [12, 0, 0.7]] },
  offbeat: { label: "Offbeat",   steps: [[2, 12, 0.8], [6, 12, 0.8], [10, 12, 0.8], [14, 12, 0.8]] },
  rolling: { label: "Rolling",   steps: [[0, 0, 0.9], [2, 12, 0.55], [4, 0, 0.8], [6, 12, 0.55], [8, 0, 0.85], [10, 12, 0.55], [12, 0, 0.8], [14, 12, 0.6]] },
};

/* chord ("chorus") rhythm styles: bar-step hits */
type ChordStyle = { label: string; hits: number[]; dur: number | "bar"; roll?: number };
const CHORD_STYLES: Record<string, ChordStyle> = {
  pads:  { label: "Pads",      hits: [0], dur: "bar" },
  push:  { label: "Push",      hits: [0, 10], dur: 0.34 },
  roll:  { label: "Slow Roll", hits: [0], dur: "bar", roll: 0.038 },
  stabs: { label: "Stabs",     hits: [2, 6, 10, 14], dur: 0.19 },
};
const VOICES: { id: LeadVoice; label: string }[] = [
  { id: "piano", label: "Piano" }, { id: "steel", label: "Steel" }, { id: "pluck", label: "Pluck" },
  { id: "saw", label: "Saw" }, { id: "brass", label: "Brass" },
];

/* melody: minor pentatonic over the key — consonant over every diatonic chord.
 * events are [absolute step 0-63, pentatonic index (2 octaves), length in steps] */
const PENTA = [0, 3, 5, 7, 10];
const ARP: [number, number, number][] = Array.from({ length: 32 }, (_, k) =>
  [k * 2, [0, 2, 4, 2, 5, 2, 4, 2][k % 8], 1] as [number, number, number]);
const MELS: Record<string, { label: string; notes: [number, number, number][] }> = {
  off:     { label: "Off", notes: [] },
  hook:    { label: "Hook", notes: [[0, 5, 2], [4, 4, 1], [6, 3, 2], [16, 2, 2], [20, 3, 1], [22, 4, 2], [32, 5, 2], [36, 4, 1], [38, 3, 2], [48, 6, 2], [52, 5, 1], [54, 4, 3]] },
  lazy:    { label: "Lazy", notes: [[0, 3, 4], [24, 4, 3], [32, 2, 4], [56, 5, 2]] },
  sparkle: { label: "Sparkle", notes: [[6, 7, 1], [14, 8, 1], [22, 7, 1], [30, 9, 1], [38, 7, 1], [46, 8, 1], [54, 9, 2]] },
  arp:     { label: "Arp", notes: ARP },
};

/* vocal chops & FX (ElevenLabs pack): b = bar (-1 for every bar), s = bar step */
type ChopEvent = { b: number; s: number; snd: LabSound; v: number; rate?: number };
const CHOPS: Record<string, { label: string; events: ChopEvent[] }> = {
  off:     { label: "Off", events: [] },
  adlibs:  { label: "Ad-libs", events: [{ b: 1, s: 14, snd: "vox-uh", v: 0.5 }, { b: 3, s: 6, snd: "vox-yeah", v: 0.45 }, { b: 2, s: 0, snd: "vox-hey", v: 0.4 }] },
  scratch: { label: "Scratch", events: [{ b: 3, s: 12, snd: "fx-scratch", v: 0.5 }, { b: 1, s: 4, snd: "vox-uh", v: 0.35 }] },
  oohs:    { label: "Oohs", events: [{ b: 0, s: 0, snd: "vox-oh", v: 0.4 }, { b: 2, s: 8, snd: "vox-oh", v: 0.34, rate: 1.12 }] },
  laruns:  { label: "La Runs", events: [{ b: 1, s: 8, snd: "vox-la", v: 0.42 }, { b: 3, s: 8, snd: "vox-la", v: 0.36, rate: 0.94 }] },
  chant:   { label: "Chant", events: [{ b: -1, s: 12, snd: "vox-chant", v: 0.45 }] },
  heys:    { label: "Hey!", events: [{ b: -1, s: 4, snd: "vox-hey", v: 0.38 }, { b: -1, s: 12, snd: "vox-hey", v: 0.3 }] },
  build:   { label: "Build", events: [{ b: 3, s: 8, snd: "fx-riser", v: 0.5 }, { b: 3, s: 15, snd: "fx-sweep", v: 0.35 }, { b: 0, s: 0, snd: "fx-drop", v: 0.55 }] },
};

/* textures: quiet glue — synth percussion or lab atmospheres */
type TexDef = { label: string; synth?: { voice: "rim" | "hat" | "perc"; steps: [number, number][] }; lab?: ChopEvent[] };
const TEX: Record<string, TexDef> = {
  off:    { label: "Off" },
  ride:   { label: "Rim Tick", synth: { voice: "rim", steps: [[3, 0.4], [11, 0.4]] } },
  shaker: { label: "Shaker", synth: { voice: "hat", steps: [[1, 0.13], [3, 0.11], [5, 0.13], [7, 0.11], [9, 0.13], [11, 0.11], [13, 0.13], [15, 0.17]] } },
  talk:   { label: "Perc Talk", synth: { voice: "perc", steps: [[7, 0.45], [14, 0.32]] } },
  vinyl:  { label: "Vinyl", lab: [{ b: -1, s: 0, snd: "fx-vinyl", v: 0.3 }] },
  air:    { label: "Air", lab: [{ b: 0, s: 0, snd: "fx-air", v: 0.42 }, { b: 2, s: 0, snd: "fx-air", v: 0.36 }] },
};

/* drum patterns: rows = kick / backbeat / closed hat / aux, 16 steps per bar */
type DrumPat = { label: string; rows: [number[], number[], number[], number[]] };
const DRUMS: Record<string, DrumPat> = {
  boombap:  { label: "Boom Bap", rows: [[0, 7, 10], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14], []] },
  knock:    { label: "Knock", rows: [[0, 3, 6, 10], [4, 12], [0, 2, 4, 6, 7, 8, 10, 12, 14, 15], [11]] },
  slowburn: { label: "Slow Burn", rows: [[0, 10], [8], [0, 2, 4, 6, 8, 10, 12, 14], [14]] },
  twostep:  { label: "Two Step", rows: [[0, 6, 10], [4, 12], [0, 2, 4, 6, 8, 10, 12, 13, 14], [7]] },
  four:     { label: "Four Floor", rows: [[0, 4, 8, 12], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14], [2, 6, 10, 14]] },
  garage:   { label: "Garage", rows: [[0, 10], [4, 12], [0, 2, 4, 6, 8, 10, 11, 14], [6, 14]] },
};

const GENRES: Record<Genre, {
  label: string; accent: string; bpm: [number, number, number]; swing: number;
  kits: DrumKitName[]; backVoice: "snare" | "clap"; auxVoice: "rim" | "perc" | "open"; auxLabel: string;
  drums: string[]; bass: string[]; progs: string[]; styles: string[]; voice: LeadVoice;
  melVoice: LeadVoice; mels: string[]; chops: string[]; tex: string[];
}> = {
  rap: {
    label: "Rap / Hip-Hop", accent: "#ffb02e", bpm: [70, 100, 88], swing: 22,
    kits: ["boom", "punch", "wood"], backVoice: "snare", auxVoice: "rim", auxLabel: "Rim",
    drums: ["boombap", "knock"], bass: ["hold", "boombap", "bounce"],
    progs: ["menace", "cypher", "soulflip"], styles: ["push", "pads", "roll"], voice: "piano",
    melVoice: "pluck", mels: ["off", "hook", "lazy"], chops: ["off", "adlibs", "scratch", "build"],
    tex: ["off", "vinyl", "ride", "talk"],
  },
  rnb: {
    label: "R&B", accent: "#c48bff", bpm: [60, 95, 74], swing: 30,
    kits: ["wood", "boom", "punch"], backVoice: "clap", auxVoice: "perc", auxLabel: "Perc",
    drums: ["slowburn", "twostep"], bass: ["hold", "slowjam", "bounce"],
    progs: ["silk", "latenight", "heartbreak"], styles: ["roll", "pads", "push"], voice: "steel",
    melVoice: "steel", mels: ["off", "lazy", "hook"], chops: ["off", "oohs", "laruns", "build"],
    tex: ["off", "air", "shaker", "ride"],
  },
  house: {
    label: "House", accent: "#4be1ff", bpm: [118, 132, 124], swing: 0,
    kits: ["club", "punch"], backVoice: "clap", auxVoice: "open", auxLabel: "Open Hat",
    drums: ["four", "garage"], bass: ["offbeat", "rolling", "hold"],
    progs: ["pianohouse", "warehouse", "euphoria"], styles: ["stabs", "pads"], voice: "piano",
    melVoice: "pluck", mels: ["off", "arp", "sparkle"], chops: ["off", "chant", "heys", "build"],
    tex: ["off", "shaker", "air"],
  },
};

type Cfg = {
  genre: Genre; key: number; bpm: number; swing: number; kit: DrumKitName;
  drums: string; grid: boolean[][];
  bassPat: string; prog: string; style: string; voice: LeadVoice;
  mel: string; chop: string; tex: string;
};

const gridOf = (patId: string): boolean[][] =>
  DRUMS[patId].rows.map((row) => Array.from({ length: 16 }, (_, s) => row.includes(s)));

const defaults = (genre: Genre, keepKey = 0): Cfg => {
  const G = GENRES[genre];
  return {
    genre, key: keepKey, bpm: G.bpm[2], swing: G.swing, kit: G.kits[0],
    drums: G.drums[0], grid: gridOf(G.drums[0]),
    bassPat: G.bass[0], prog: G.progs[0], style: G.styles[0], voice: G.voice,
    mel: G.mels[1], chop: "off", tex: G.tex[1],
  };
};

const LS_KEY = "dialed-lab-v1";
const LOOP_STEPS = 64;

/* small chip-row helper */
function Chips({ label, items, active, onPick }: {
  label: string;
  items: { id: string; label: string }[];
  active: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.chips}>
        {items.map((it, i) => (
          <button key={it.id} className="mode" aria-pressed={active === it.id}
            data-note={392 + i * 36} onClick={() => onPick(it.id)}>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function BeatLab() {
  const [cfg, setCfg] = useState<Cfg>(() => defaults("rap"));
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uiStep, setUiStep] = useState(-1);
  const cfgRef = useRef(cfg);
  const playingRef = useRef(false);
  const timer = useRef<number | null>(null);
  const sched = useRef({ step: 0, nextT: 0 });

  const G = GENRES[cfg.genre];

  /* hydrate the saved beat; persist every change */
  useEffect(() => {
    preloadAllKits();
    loadLabSamples();
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const saved = { ...defaults("rap"), ...JSON.parse(raw) } as Cfg;
        if (GENRES[saved.genre] && Array.isArray(saved.grid) && saved.grid.length === 4) setCfg(saved);
      }
    } catch { /* fresh start */ }
  }, []);
  useEffect(() => {
    cfgRef.current = cfg;
    try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch { /* no persistence */ }
  }, [cfg]);

  const set = (patch: Partial<Cfg>) => setCfg((c) => ({ ...c, ...patch }));

  /* ---------------- scheduler: one 4-bar loop of 64 sixteenths ---------------- */

  const scheduleStep = (i: number, tGrid: number, stepDur: number) => {
    const C = cfgRef.current;
    const GG = GENRES[C.genre];
    const bar = i >> 4, s = i & 15;
    const t = tGrid + (s % 2 === 1 ? (C.swing / 100) * stepDur * 0.55 : 0);

    /* drums from the grid */
    if (C.grid[0][s]) kick(t, s === 0 ? 0.95 : 0.85);
    if (C.grid[1][s]) (GG.backVoice === "snare" ? snare : clap)(t, 0.7);
    if (C.grid[2][s]) hat(t, false, s % 4 === 0 ? 0.32 : 0.24);
    if (C.grid[3][s]) {
      if (GG.auxVoice === "open") hat(t, true, 0.28);
      else if (GG.auxVoice === "rim") rim(t, 0.5);
      else perc(t, 0.5);
    }

    const chord = PROGS[C.prog].bars[bar];
    const bassDeg = chord.deg >= 8 ? chord.deg - 12 : chord.deg; /* VI/VII walk below the root */

    /* bass follows the chord root — always in key */
    for (const [bs, add, v] of BASS[C.bassPat].steps) {
      if (bs === s) bass(t, C.key + bassDeg + add, v);
    }

    /* chords */
    const st = CHORD_STYLES[C.style];
    if (st.hits.includes(s)) {
      const dur = st.dur === "bar" ? stepDur * 16 * 0.9 : st.dur;
      let root = 53 + C.key + chord.deg; /* keep roots around F3-B3 */
      if (root >= 60) root -= 12;
      chord.iv.forEach((iv, k) =>
        stab(t + (st.roll ? k * st.roll : 0), root + iv, dur, C.voice, 0.08));
    }

    /* melody: minor pentatonic of the key */
    for (const [ms, idx, len] of MELS[C.mel].notes) {
      if (ms === i) stab(t, 65 + C.key + PENTA[idx % 5] + 12 * Math.floor(idx / 5), len * stepDur * 0.9, GG.melVoice, 0.07);
    }

    /* vocal chops & FX */
    for (const ev of CHOPS[C.chop].events) {
      if ((ev.b === -1 || ev.b === bar) && ev.s === s) labPlay(ev.snd, t, ev.v, ev.rate ?? 1);
    }

    /* texture */
    const tx = TEX[C.tex];
    if (tx.synth) {
      for (const [ts, v] of tx.synth.steps) {
        if (ts === s) (tx.synth.voice === "rim" ? rim : tx.synth.voice === "perc" ? perc : (tt: number, vv: number) => hat(tt, false, vv))(t, v);
      }
    }
    if (tx.lab) {
      for (const ev of tx.lab) {
        if ((ev.b === -1 || ev.b === bar) && ev.s === s) labPlay(ev.snd, t, ev.v, 1, 0.12);
      }
    }

    /* playhead */
    const c = audio();
    window.setTimeout(() => { if (playingRef.current) setUiStep(i); },
      Math.max(0, (t - c.currentTime) * 1000));
  };

  const tick = () => {
    const c = audio();
    const stepDur = 60 / cfgRef.current.bpm / 4;
    while (sched.current.nextT < c.currentTime + 0.16) {
      scheduleStep(sched.current.step, sched.current.nextT, stepDur);
      sched.current.step = (sched.current.step + 1) % LOOP_STEPS;
      sched.current.nextT += stepDur;
    }
  };

  const startLoop = () => {
    const c = audio();
    void unlockAudio();
    setDrumKit(cfgRef.current.kit);
    if (timer.current !== null) window.clearInterval(timer.current);
    sched.current = { step: 0, nextT: c.currentTime + 0.12 };
    timer.current = window.setInterval(tick, 30);
    playingRef.current = true;
    setPlaying(true);
  };

  const stopLoop = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    playingRef.current = false;
    setPlaying(false);
    setUiStep(-1);
  };

  useEffect(() => stopLoop, []);

  /* ---------------- download: record two loops off the master bus ---------------- */

  const download = () => {
    if (recording) return;
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      .find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
    if (!mime) return;
    const C = cfgRef.current;
    startLoop(); /* restart from bar 1 so the take is clean */
    const rec = new MediaRecorder(outputStream(), { mimeType: mime, audioBitsPerSecond: 192000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const ext = mime.startsWith("audio/mp4") ? "m4a" : "webm";
      const url = URL.createObjectURL(new Blob(chunks, { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `delulu-${C.genre}-${C.bpm}bpm.${ext}`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setRecording(false);
    };
    rec.start();
    setRecording(true);
    const ms = (60 / C.bpm / 4) * LOOP_STEPS * 2 * 1000 + 400; /* 8 bars + tail */
    window.setTimeout(() => rec.stop(), ms);
  };

  /* ---------------- helpers ---------------- */

  const pickGenre = (genre: Genre) => {
    setCfg((c) => defaults(genre, c.key));
    if (playingRef.current) window.setTimeout(startLoop, 40);
  };

  const surprise = () => {
    const g = cfgRef.current.genre;
    const GG = GENRES[g];
    const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
    const drums = pick(GG.drums);
    set({
      bpm: GG.bpm[0] + Math.round(Math.random() * (GG.bpm[1] - GG.bpm[0])),
      kit: pick(GG.kits), drums, grid: gridOf(drums),
      bassPat: pick(GG.bass), prog: pick(GG.progs), style: pick(GG.styles),
      voice: pick([GG.voice, ...VOICES.map((v) => v.id)]),
      mel: pick(GG.mels), chop: pick(GG.chops), tex: pick(GG.tex),
    });
    uiBlip(784, 0.06);
  };

  const toggleCell = (row: number, col: number) => {
    const grid = cfg.grid.map((r) => [...r]);
    grid[row][col] = !grid[row][col];
    set({ grid, drums: "custom" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const idle = !document.activeElement || document.activeElement === document.body;
      if (e.key === " " && idle && !e.repeat) {
        e.preventDefault();
        if (playingRef.current) stopLoop(); else startLoop();
      }
      if (e.key === "Escape" && playingRef.current && !document.fullscreenElement) {
        e.preventDefault();
        stopLoop();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------- render ---------------- */

  const uiBar = uiStep >= 0 ? uiStep >> 4 : -1;
  const uiCol = uiStep >= 0 ? uiStep & 15 : -1;
  const prog = PROGS[cfg.prog];
  const rowNames = ["Kick", G.backVoice === "snare" ? "Snare" : "Clap", "Hat", G.auxLabel];
  const drumChips = [
    ...G.drums.map((id) => ({ id, label: DRUMS[id].label })),
    ...(cfg.drums === "custom" ? [{ id: "custom", label: "Custom" }] : []),
  ];

  return (
    <main className={`stage menuStage ${styles.studio}`} style={{ "--acc": G.accent } as AccStyle}>
      <Stagger className={styles.inner}>
        <Item>
          <header className={styles.head}>
            <h1 className="wordmark">Beat Lab</h1>
            <p className="tagline">
              Not a game — your track. Pick and mix drums, bass, chords, melody and chops;
              everything is locked to one key so it always lands. Then download it.
            </p>
          </header>
        </Item>

        <Item>
          <div className={styles.rowGroup}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Genre</span>
              <div className={styles.chips}>
                {(Object.keys(GENRES) as Genre[]).map((g, i) => (
                  <button key={g} className="mode" aria-pressed={cfg.genre === g}
                    data-note={440 + i * 52} onClick={() => pickGenre(g)}>
                    {GENRES[g].label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Key</span>
              <div className={styles.chips}>
                {KEYS.map((k, i) => (
                  <button key={k.label} className="mode" aria-pressed={cfg.key === k.semi}
                    data-note={349 + i * 30} onClick={() => set({ key: k.semi })}>
                    {k.label}m
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.sliders}>
              <label className={styles.slider}>
                <span>Tempo <b>{cfg.bpm}</b> BPM</span>
                <input type="range" min={G.bpm[0]} max={G.bpm[1]} value={cfg.bpm}
                  onChange={(e) => set({ bpm: parseInt(e.target.value, 10) })} />
              </label>
              <label className={styles.slider}>
                <span>Swing <b>{cfg.swing}</b>%</span>
                <input type="range" min={0} max={60} value={cfg.swing}
                  onChange={(e) => set({ swing: parseInt(e.target.value, 10) })} />
              </label>
            </div>
          </div>
        </Item>

        <Item>
          <div className={styles.transport}>
            <button className="cta" data-note={523} onClick={() => (playing ? stopLoop() : startLoop())}>
              {playing ? "Stop ■" : "Play ▸"}
            </button>
            <button className="ghost" data-note={440} onClick={surprise}>Surprise me</button>
            <button className="ghost" data-note={392} onClick={download} disabled={recording}>
              {recording ? "Recording 8 bars…" : "Download"}
            </button>
          </div>
        </Item>

        <Item>
          <section className={styles.panel}>
            <Chips label="Drums" items={drumChips} active={cfg.drums}
              onPick={(id) => { if (id !== "custom") set({ drums: id, grid: gridOf(id) }); }} />
            <Chips label="Kit" items={G.kits.map((k) => ({ id: k, label: k[0].toUpperCase() + k.slice(1) }))}
              active={cfg.kit} onPick={(id) => { set({ kit: id as DrumKitName }); setDrumKit(id as DrumKitName); }} />
            <div className={styles.gridWrap}>
              <div className={styles.dgrid}>
                {cfg.grid.map((row, r) => (
                  <div key={r} className={styles.drow}>
                    <span className={styles.dlabel}>{rowNames[r]}</span>
                    {row.map((on, c2) => (
                      <button key={c2} aria-label={`${rowNames[r]} step ${c2 + 1}`}
                        className={[styles.cell, on ? styles.cellOn : "", c2 % 4 === 0 ? styles.q : "",
                          playing && c2 === uiCol ? styles.cellNow : ""].join(" ")}
                        onClick={() => toggleCell(r, c2)} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Item>

        <Item>
          <section className={styles.panel}>
            <Chips label="Bass" items={G.bass.map((id) => ({ id, label: BASS[id].label }))}
              active={cfg.bassPat} onPick={(id) => set({ bassPat: id })} />
            <Chips label="Chorus" items={G.progs.map((id) => ({ id, label: PROGS[id].label }))}
              active={cfg.prog} onPick={(id) => set({ prog: id })} />
            <div className={styles.row}>
              <span className={styles.rowLabel} />
              <div className={styles.roman}>
                {prog.roman.map((r2, i) => (
                  <span key={i} className={playing && i === uiBar ? styles.romanNow : ""}>{r2}</span>
                ))}
              </div>
            </div>
            <Chips label="Style" items={G.styles.map((id) => ({ id, label: CHORD_STYLES[id].label }))}
              active={cfg.style} onPick={(id) => set({ style: id })} />
            <Chips label="Voice" items={VOICES.map((v) => ({ id: v.id, label: v.label }))}
              active={cfg.voice} onPick={(id) => set({ voice: id as LeadVoice })} />
          </section>
        </Item>

        <Item>
          <section className={styles.panel}>
            <Chips label="Melody" items={G.mels.map((id) => ({ id, label: MELS[id].label }))}
              active={cfg.mel} onPick={(id) => set({ mel: id })} />
            <Chips label="Chops" items={G.chops.map((id) => ({ id, label: CHOPS[id].label }))}
              active={cfg.chop} onPick={(id) => set({ chop: id })} />
            <Chips label="Texture" items={G.tex.map((id) => ({ id, label: TEX[id].label }))}
              active={cfg.tex} onPick={(id) => set({ tex: id })} />
          </section>
        </Item>

        <Item>
          <div className="kbd">
            <span><b>Space</b>play / stop</span>
            <span><b>Esc</b>stop</span>
            <span><b>F</b>fullscreen</span>
          </div>
        </Item>
      </Stagger>
    </main>
  );
}
