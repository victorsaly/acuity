"use client";

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import {
  audio, unlockAudio, bass, clap, hat, kick, perc, rim, snare, stab, uiBlip,
  setDrumKit, loadKitSamples, loadLabSamples, labPlay, outputStream, encodeWav, setTurntableRate,
  voicePlay, voiceReady, saveVoiceClip, clearVoiceClip, loadVoiceClip, trimBuffer,
  type DrumKitName, type LeadVoice, type LabSound, type VoiceFx,
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

function StaticBlock({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

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
  { id: "piano", label: "Piano" }, { id: "rhodes", label: "Rhodes" }, { id: "organ", label: "Organ" },
  { id: "sax", label: "Sax" }, { id: "guitar", label: "Guitar" }, { id: "bell", label: "Bell" },
  { id: "steel", label: "Steel" }, { id: "pluck", label: "Pluck" }, { id: "saw", label: "Saw" },
  { id: "brass", label: "Brass" },
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
  trap:     { label: "Trap", rows: [[0, 7, 11], [8], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [15]] },
  skippy:   { label: "Skippy", rows: [[0, 5, 8], [4, 12], [0, 2, 3, 6, 8, 10, 11, 14], [2, 9]] },
};

/* every preset works in every genre — pools just put the genre's own first */
const poolAll = (own: readonly string[], dict: Record<string, unknown>) =>
  [...own, ...Object.keys(dict).filter((k) => !own.includes(k))];
const ALL_KITS: DrumKitName[] = ["punch", "boom", "club", "wood"];

const GENRES: Record<Genre, {
  label: string; accent: string; bpm: [number, number, number]; swing: number;
  kits: DrumKitName[]; backVoice: "snare" | "clap"; auxVoice: "rim" | "perc" | "open"; auxLabel: string;
  drums: string[]; bass: string[]; progs: string[]; styles: string[]; voice: LeadVoice;
  melVoice: LeadVoice; mels: string[]; chops: string[]; tex: string[];
}> = {
  rap: {
    label: "Rap / Hip-Hop", accent: "#ffb02e", bpm: [70, 100, 88], swing: 22,
    kits: ["boom", "punch", "wood"], backVoice: "snare", auxVoice: "rim", auxLabel: "Rim",
    drums: ["boombap", "knock", "trap"], bass: ["hold", "boombap", "bounce"],
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
    drums: ["four", "garage", "skippy"], bass: ["offbeat", "rolling", "hold"],
    progs: ["pianohouse", "warehouse", "euphoria"], styles: ["stabs", "pads"], voice: "piano",
    melVoice: "pluck", mels: ["off", "arp", "sparkle"], chops: ["off", "chant", "heys", "build"],
    tex: ["off", "shaker", "air"],
  },
};

type Cfg = {
  genre: Genre; key: number; bpm: number; swing: number; kit: DrumKitName;
  drums: string; grid: boolean[][];
  bassPat: string; bassSteps: [number, number][]; /* [bar step 0-15, semis above chord root] */
  prog: string; style: string; voice: LeadVoice;
  mel: string; melNotes: [number, number][]; /* [absolute step 0-63, pentatonic row 0-9] */
  melVoice: LeadVoice; chop: string; tex: string;
  voiceOn: boolean; voiceFx: VoiceFx;
  mix: { drums: number; bass: number; chords: number; mel: number; fx: number; voice: number };
};

const gridOf = (patId: string): boolean[][] =>
  DRUMS[patId].rows.map((row) => Array.from({ length: 16 }, (_, s) => row.includes(s)));

/* preset -> editable note lists (custom notes play a fixed musical length) */
const melNotesOf = (id: string): [number, number][] =>
  (MELS[id]?.notes ?? []).map(([st, idx]) => [st, idx] as [number, number]);
const bassStepsOf = (id: string): [number, number][] =>
  (BASS[id]?.steps ?? []).map(([st, add]) => [st, add] as [number, number]);

const melPitch = (key: number, idx: number) =>
  65 + key + PENTA[idx % 5] + 12 * Math.floor(idx / 5);
const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const melRowName = (key: number, idx: number) =>
  NOTE_NAMES[melPitch(key, idx) % 12] + (idx >= 5 ? "↑" : "");
const BASS_ROWS: { add: number; label: string }[] = [
  { add: 12, label: "Oct ↑" }, { add: 7, label: "5th" }, { add: 0, label: "Root" },
];

const defaults = (genre: Genre, keepKey = 0): Cfg => {
  const G = GENRES[genre];
  return {
    genre, key: keepKey, bpm: G.bpm[2], swing: G.swing, kit: G.kits[0],
    drums: G.drums[0], grid: gridOf(G.drums[0]),
    bassPat: G.bass[0], bassSteps: bassStepsOf(G.bass[0]),
    prog: G.progs[0], style: G.styles[0], voice: G.voice,
    mel: G.mels[1], melNotes: melNotesOf(G.mels[1]), melVoice: G.melVoice, chop: "off", tex: G.tex[1],
    voiceOn: false, voiceFx: "dry",
    mix: { drums: 100, bass: 100, chords: 100, mel: 100, fx: 100, voice: 105 },
  };
};

const LS_KEY = "dialed-lab-v1";
const LOOP_STEPS = 64;

/* one-line explanations, shown in the info bar on rollover/focus */
const TIPS: Record<string, Record<string, string>> = {
  genre: {
    rap: "Head-nod hip-hop — swung boom-bap drums around 88 BPM.",
    rnb: "Slow-burn R&B — claps, lush minor-9 chords, a 74 BPM glide.",
    house: "Four-on-the-floor club energy at 124 BPM — piano stabs and chants.",
  },
  key: Object.fromEntries(KEYS.map((k) => [String(k.semi),
    `Re-tunes every tonal layer to ${k.label} minor — nothing can play out of key.`])),
  drums: {
    boombap: "Kick on the one, a lazy answer kick — the classic head-nod skeleton.",
    knock: "Busy doubled kicks and extra hats — hits harder.",
    slowburn: "Half-time: one snare on beat 3, huge space between hits.",
    twostep: "Skipping kicks that dodge the grid — light on its feet.",
    four: "A kick on every beat with offbeat hats — the house heartbeat.",
    garage: "Shuffled 2-step garage bounce.",
    trap: "Machine-gun 16th hats, sparse kicks, one late snare.",
    skippy: "Broken, syncopated kicks that skip and stumble.",
    custom: "Your own pattern — tap cells in the grid below to edit it.",
  },
  kit: {
    punch: "Tight, punchy modern kit.",
    boom: "Dusty, low-slung boom-bap kit.",
    club: "Clean electronic club kit.",
    wood: "Warm, woody hand percussion.",
  },
  bass: {
    hold: "One long sub note per bar — maximum weight, zero clutter.",
    boombap: "Root-note thumps answering the kick.",
    bounce: "Octave-hopping bounce under the beat.",
    slowjam: "Late, lazy notes that slide in under the chords.",
    offbeat: "Offbeat octave stabs — instant house energy.",
    rolling: "An eighth-note roller that never stops moving.",
    custom: "Your own bassline — drawn in the grid below.",
  },
  prog: {
    menace: "i–VI–III–VII — dark and cinematic.",
    cypher: "i–iv–i–v — a heads-down loop you can rap on for days.",
    soulflip: "Soul-sample colours built on minor 9ths.",
    silk: "A smooth minor-9 turnaround.",
    latenight: "Moody after-hours changes.",
    heartbreak: "Starts away from home, lands on the saddest chord.",
    pianohouse: "The classic rave piano changes.",
    warehouse: "One chord, all night long.",
    euphoria: "A hands-in-the-air lift and release.",
  },
  style: {
    pads: "Chords held for the whole bar — a soft bed.",
    push: "Two pushes per bar — gives the chords a pulse.",
    roll: "Notes rolled one after another, like a harp.",
    stabs: "Short offbeat jabs — pure club.",
  },
  voice: {
    piano: "Bright acoustic piano.", rhodes: "Soft, rounded electric piano.",
    organ: "Breathing drawbar organ.", sax: "Breathy sax with slow vibrato.",
    guitar: "Plucked nylon guitar.", bell: "Glassy, ringing bell.",
    steel: "Sunny steel pan.", pluck: "Snappy synth pluck.",
    saw: "Fat, buzzy saw synth.", brass: "Stabby synth brass.",
  },
  mel: {
    off: "No melody layer.",
    hook: "A singable four-bar topline.",
    lazy: "A few long notes with lots of space.",
    sparkle: "High, glittery accents on the offbeats.",
    arp: "A rolling arpeggio that never rests.",
    custom: "Your own topline — drawn in the grid below.",
  },
  chop: {
    off: "No vocal chops.",
    adlibs: "Uh / yeah / hey scattered through the bars.",
    scratch: "A DJ scratch with a grunt behind it.",
    oohs: "Soulful ooh chops on the downbeats.",
    laruns: "R&B la-la runs floating over the top.",
    chant: "A crowd chant landing every bar.",
    heys: "Hey! stabs on the offbeats, every bar.",
    build: "A riser and sweep into a sub drop.",
  },
  tex: {
    off: "No texture layer.",
    ride: "Quiet rim ticks riding behind the kit.",
    shaker: "A steady 16th-note shaker.",
    talk: "Percussion that answers the beat.",
    vinyl: "Vinyl crackle under everything.",
    air: "Airy pad swells breathing through the bars.",
  },
  boothVoice: {
    on: "Your take plays in the loop, in time with the beat.",
    off: "Your take stays muted — the beat plays without it.",
  },
  tone: {
    dry: "No effect — your voice exactly as recorded.",
    radio: "A small-speaker telephone squeeze.",
    echo: "A beat-synced echo trailing your voice.",
  },
};

/* ---------------- rollover previews (module scope — the studio page is a singleton) ----------------
 * Hovering an option explains it in the info bar and, while the loop is
 * stopped, plays the actual sound it will make.  While the loop runs, a soft
 * blip keeps rollover feedback without fighting the groove — clicking swaps
 * the option straight into the live loop, which IS the audition. */

const live: { cfg: Cfg | null; playing: boolean } = { cfg: null, playing: false };
let infoEl: HTMLParagraphElement | null = null;
let pvClock = 0;

const announce = (text: string | null) => {
  if (!infoEl) return;
  infoEl.textContent = text ?? "";
  infoEl.dataset.on = text ? "1" : "0";
};

const cur = (): Cfg => live.cfg ?? defaults("rap");

const pv = (fn: (id: string) => void) => (id: string) => {
  if (live.playing) { uiBlip(660, 0.045); return; }
  void unlockAudio();
  const t = audio().currentTime;
  if (t - pvClock < 0.15) return;
  pvClock = t;
  fn(id);
};

/* half a bar of a drum pattern, with the right back/aux voices */
const drumSnippet = (patId: string, GG: (typeof GENRES)[Genre], bpm: number) => {
  const rows = DRUMS[patId]?.rows;
  if (!rows) return;
  const dur = 60 / bpm / 4;
  const t0 = audio().currentTime + 0.02;
  for (let st = 0; st < 8; st++) {
    const t = t0 + st * dur;
    if (rows[0].includes(st)) kick(t, 0.85);
    if (rows[1].includes(st)) (GG.backVoice === "snare" ? snare : clap)(t, 0.65);
    if (rows[2].includes(st)) hat(t, false, 0.25);
    if (rows[3].includes(st)) {
      if (GG.auxVoice === "open") hat(t, true, 0.26);
      else if (GG.auxVoice === "rim") rim(t, 0.45);
      else perc(t, 0.45);
    }
  }
};

const chordRoot = (deg: number) => {
  let root = 53 + cur().key + deg;
  if (root >= 60) root -= 12;
  return root;
};

const previewGenre = pv((id) => {
  const GG = GENRES[id as Genre];
  drumSnippet(GG.drums[0], GG, GG.bpm[2]);
});
const previewKey = pv((id) => {
  const semi = Number(id);
  const t0 = audio().currentTime + 0.02;
  bass(t0, semi, 0.85);
  [0, 3, 7].forEach((iv) => stab(t0 + 0.1, 53 + semi + iv, 0.7, cur().voice, 0.07));
});
const previewDrums = pv((id) => {
  const C = cur();
  drumSnippet(id, GENRES[C.genre], C.bpm);
});
const previewKit = pv((id) => {
  const k = id as DrumKitName;
  loadKitSamples(k);
  setDrumKit(k);
  const t0 = audio().currentTime + 0.02;
  kick(t0, 0.9); hat(t0 + 0.16, false, 0.3); snare(t0 + 0.32, 0.75); hat(t0 + 0.48, false, 0.24);
  setDrumKit(cur().kit);
});
const previewBass = pv((id) => {
  const C = cur();
  const dur = 60 / C.bpm / 4;
  const t0 = audio().currentTime + 0.02;
  const steps = id === "custom" ? C.bassSteps.map(([st, add]) => [st, add, 0.8] as const) : BASS[id]?.steps ?? [];
  for (const [bs, add, v] of steps) bass(t0 + bs * dur, C.key + add, v * 0.9);
});
const previewProg = pv((id) => {
  const C = cur();
  const t0 = audio().currentTime + 0.02;
  PROGS[id].bars.slice(0, 2).forEach((b, i) =>
    b.iv.forEach((iv) => stab(t0 + i * 0.55, chordRoot(b.deg) + iv, 0.5, C.voice, 0.085)));
});
const previewStyle = pv((id) => {
  const C = cur();
  const st = CHORD_STYLES[id];
  const chord = PROGS[C.prog].bars[0];
  const dur = 60 / C.bpm / 4;
  const t0 = audio().currentTime + 0.02;
  st.hits.slice(0, 3).forEach((h) => chord.iv.forEach((iv, k) =>
    stab(t0 + h * dur + (st.roll ? k * st.roll : 0), chordRoot(chord.deg) + iv,
      st.dur === "bar" ? 1.1 : st.dur, C.voice, 0.08)));
});
const previewChordVoice = pv((id) => {
  const C = cur();
  const chord = PROGS[C.prog].bars[0];
  const t0 = audio().currentTime + 0.02;
  chord.iv.forEach((iv) => stab(t0, chordRoot(chord.deg) + iv, 0.7, id as LeadVoice, 0.09));
});
const previewLeadVoice = pv((id) => {
  const C = cur();
  const t0 = audio().currentTime + 0.02;
  stab(t0, 65 + C.key, 0.3, id as LeadVoice, 0.11);
  stab(t0 + 0.22, 65 + C.key + 3, 0.55, id as LeadVoice, 0.11);
});
const previewMel = pv((id) => {
  const C = cur();
  const dur = 60 / C.bpm / 4;
  const t0 = audio().currentTime + 0.02;
  const raw = id === "custom" ? C.melNotes : MELS[id]?.notes ?? [];
  if (!raw.length) return;
  const notes = [...raw].sort((a, b) => a[0] - b[0]);
  const start = notes[0][0];
  for (const [ms2, idx, len] of notes) {
    const at = (ms2 - start) * dur;
    if (at > 1.6) break;
    stab(t0 + at, melPitch(C.key, idx), (len ?? 2) * dur * 0.9, C.melVoice, 0.09);
  }
});
const previewChop = pv((id) => {
  const ev = CHOPS[id].events[0];
  if (ev) labPlay(ev.snd, audio().currentTime + 0.02, ev.v, ev.rate ?? 1);
});
const previewTex = pv((id) => {
  const tx = TEX[id];
  const C = cur();
  const dur = 60 / C.bpm / 4;
  const t0 = audio().currentTime + 0.02;
  if (tx.lab?.length) labPlay(tx.lab[0].snd, t0, tx.lab[0].v, 1, 0.12);
  if (tx.synth) {
    for (const [ts, v] of tx.synth.steps) {
      if (ts < 8) (tx.synth.voice === "rim" ? rim : tx.synth.voice === "perc" ? perc
        : (tt: number, vv: number) => hat(tt, false, vv))(t0 + ts * dur, v);
    }
  }
});

/* Note grids are memoized and get NO playhead prop — re-rendering ~700 buttons
 * every 16th note costs real frames.  The playhead is painted imperatively:
 * paintPlayhead() toggles the cellNow class through the grid refs. */

const MelodyGrid = memo(function MelodyGrid({ notes, keySemi, onToggle, gridRef }: {
  notes: [number, number][];
  keySemi: number;
  onToggle: (idx: number, step: number) => void;
  gridRef: RefObject<HTMLDivElement | null>;
}) {
  const on = new Set(notes.map(([s2, i2]) => i2 * 64 + s2));
  return (
    <div className={styles.gridWrap}>
      {/* bar ruler lives outside the ref'd grid so the playhead painter never touches it */}
      <div className={`${styles.drow} ${styles.rulerRow}`} aria-hidden>
        <span className={styles.dlabel} />
        {[1, 2, 3, 4].map((b) => <span key={b} className={styles.ruler}>Bar {b}</span>)}
      </div>
      <div className={styles.mgrid} ref={gridRef}>
        {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((idx) => (
          <div key={idx} className={styles.drow}>
            <span className={styles.dlabel}>{melRowName(keySemi, idx)}</span>
            {Array.from({ length: 64 }, (_, st) => (
              <button key={st} aria-label={`Melody ${melRowName(keySemi, idx)} step ${st + 1}`}
                className={[styles.mcell, on.has(idx * 64 + st) ? styles.cellOn : "",
                  st % 16 === 0 ? styles.bar : st % 4 === 0 ? styles.q : ""].join(" ")}
                onClick={() => onToggle(idx, st)} />
            ))}
          </div>
        ))}
      </div>
      {notes.length === 0 && (
        <p className={styles.gridEmpty}>
          The topline is empty — tap cells to place notes, or load a Melody preset above as a starting point.
        </p>
      )}
    </div>
  );
});

const BassGrid = memo(function BassGrid({ steps, onToggle, gridRef }: {
  steps: [number, number][];
  onToggle: (add: number, step: number) => void;
  gridRef: RefObject<HTMLDivElement | null>;
}) {
  const on = new Set(steps.map(([s2, a2]) => a2 * 16 + s2));
  return (
    <div className={styles.gridWrap}>
      <div className={styles.dgrid} ref={gridRef}>
        {BASS_ROWS.map(({ add, label }) => (
          <div key={add} className={styles.drow}>
            <span className={styles.dlabel}>{label}</span>
            {Array.from({ length: 16 }, (_, c2) => (
              <button key={c2} aria-label={`Bass ${label} step ${c2 + 1}`}
                className={[styles.cell, on.has(add * 16 + c2) ? styles.cellOn : "",
                  c2 % 4 === 0 ? styles.q : ""].join(" ")}
                onClick={() => onToggle(add, c2)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

/* small chip-row helper — rollover/focus explains the option (info bar) and,
 * when a preview fn is given, plays the actual sound the option will make */
function Chips({ label, items, active, onPick, tips, onPreview, onInfo }: {
  label: string;
  items: { id: string; label: string }[];
  active: string;
  onPick: (id: string) => void;
  tips?: Record<string, string>;
  onPreview?: (id: string) => void;
  onInfo?: (text: string | null) => void;
}) {
  const enter = (id: string, name: string) => {
    onInfo?.(tips?.[id] ? `${name} — ${tips[id]}` : null);
    onPreview?.(id);
  };
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.chips}>
        {items.map((it, i) => (
          <button key={it.id} className="mode" aria-pressed={active === it.id}
            data-note={392 + i * 36}
            data-silent={onPreview ? "" : undefined}
            onPointerEnter={(e) => { if (e.pointerType !== "touch") enter(it.id, it.label); }}
            onFocus={() => enter(it.id, it.label)}
            onPointerLeave={() => onInfo?.(null)}
            onBlur={() => onInfo?.(null)}
            onClick={() => { onPick(it.id); if (onPreview) uiBlip(650 + i * 40, 0.05, 0.11); }}>
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
  const [recLeft, setRecLeft] = useState(0);
  const [booth, setBooth] = useState<"empty" | "ready" | "arming" | "rec">("empty");
  const [recBar, setRecBar] = useState(0);
  const [boothErr, setBoothErr] = useState("");
  const boothJob = useRef<{ cancel: () => void } | null>(null);
  const recVoiceRef = useRef<() => void>(() => {});
  const [uiStep, setUiStep] = useState(-1);
  const cfgRef = useRef(cfg);
  const playingRef = useRef(false);
  const timer = useRef<number | null>(null);
  const rate = useRef(1);           // signed platter speed: <0 plays the loop backwards
  const reverse = useRef(false);
  const [revOn, setRevOn] = useState(false);
  const drag = useRef<{ angle: number; at: number } | null>(null);
  const sched = useRef({ step: 0, nextT: 0 });
  const melGridRef = useRef<HTMLDivElement>(null);
  const bassGridRef = useRef<HTMLDivElement>(null);
  const lastHead = useRef(-1);
  const spin = useRef(0);
  const discRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLElement>(null);

  const G = GENRES[cfg.genre];

  /* hydrate the saved beat; persist every change */
  useEffect(() => {
    loadKitSamples(cfgRef.current.kit);   // other kits decode on demand when picked
    loadLabSamples();
    void loadVoiceClip().then((ok) => { if (ok) setBooth("ready"); });
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const base = defaults("rap");
        const parsed = JSON.parse(raw) as Partial<Cfg>;
        const saved = { ...base, ...parsed, mix: { ...base.mix, ...(parsed.mix ?? {}) } } as Cfg;
        if (!Array.isArray(parsed.melNotes)) saved.melNotes = melNotesOf(saved.mel);
        if (!Array.isArray(parsed.bassSteps)) saved.bassSteps = bassStepsOf(saved.bassPat);
        if (GENRES[saved.genre] && Array.isArray(saved.grid) && saved.grid.length === 4) setCfg(saved);
      }
    } catch { /* fresh start */ }
  }, []);
  const persistReady = useRef(false);
  useEffect(() => {
    cfgRef.current = cfg;
    live.cfg = cfg;
    /* skip the mount run: writing the defaults here would clobber the saved
       beat before (or between, under StrictMode) the hydrate effect's reads */
    if (!persistReady.current) { persistReady.current = true; return; }
    try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch { /* no persistence */ }
  }, [cfg]);

  const set = (patch: Partial<Cfg>) => setCfg((c) => ({ ...c, ...patch }));

  /* ---------------- scheduler: one 4-bar loop of 64 sixteenths ---------------- */

  const scheduleStep = (i: number, tGrid: number, stepDur: number) => {
    const C = cfgRef.current;
    const GG = GENRES[C.genre];
    const bar = i >> 4, s = i & 15;
    const t = tGrid + (s % 2 === 1 ? (C.swing / 100) * stepDur * 0.55 : 0);

    const dv = C.mix.drums / 100, fxv = C.mix.fx / 100;

    /* drums from the grid */
    if (C.grid[0][s]) kick(t, (s === 0 ? 0.95 : 0.85) * dv);
    if (C.grid[1][s]) (GG.backVoice === "snare" ? snare : clap)(t, 0.7 * dv);
    if (C.grid[2][s]) hat(t, false, (s % 4 === 0 ? 0.32 : 0.24) * dv);
    if (C.grid[3][s]) {
      if (GG.auxVoice === "open") hat(t, true, 0.28 * dv);
      else if (GG.auxVoice === "rim") rim(t, 0.5 * dv);
      else perc(t, 0.5 * dv);
    }

    const chord = PROGS[C.prog].bars[bar];
    const bassDeg = chord.deg >= 8 ? chord.deg - 12 : chord.deg; /* VI/VII walk below the root */

    /* bass follows the chord root — always in key */
    if (C.bassPat === "custom") {
      for (const [bs, add] of C.bassSteps) {
        if (bs === s) bass(t, C.key + bassDeg + add, (add === 0 ? 0.9 : 0.7) * (C.mix.bass / 100));
      }
    } else {
      for (const [bs, add, v] of BASS[C.bassPat].steps) {
        if (bs === s) bass(t, C.key + bassDeg + add, v * (C.mix.bass / 100));
      }
    }

    /* chords */
    const st = CHORD_STYLES[C.style];
    if (st.hits.includes(s)) {
      const dur = st.dur === "bar" ? stepDur * 16 * 0.9 : st.dur;
      let root = 53 + C.key + chord.deg; /* keep roots around F3-B3 */
      if (root >= 60) root -= 12;
      chord.iv.forEach((iv, k) =>
        stab(t + (st.roll ? k * st.roll : 0), root + iv, dur, C.voice, 0.08 * (C.mix.chords / 100)));
    }

    /* melody: minor pentatonic of the key */
    if (C.mel === "custom") {
      for (const [ms, idx] of C.melNotes) {
        if (ms === i) stab(t, melPitch(C.key, idx), 2 * stepDur * 0.9, C.melVoice, 0.07 * (C.mix.mel / 100));
      }
    } else {
      for (const [ms, idx, len] of MELS[C.mel].notes) {
        if (ms === i) stab(t, melPitch(C.key, idx), len * stepDur * 0.9, C.melVoice, 0.07 * (C.mix.mel / 100));
      }
    }

    /* vocal chops & FX */
    for (const ev of CHOPS[C.chop].events) {
      if ((ev.b === -1 || ev.b === bar) && ev.s === s) labPlay(ev.snd, t, ev.v * fxv, ev.rate ?? 1);
    }

    /* your voice — the booth take loops from bar 1, following tempo & platter */
    if (i === 0 && C.voiceOn) voicePlay(t, 0.9 * (C.mix.voice / 100), C.voiceFx, C.bpm);

    /* texture */
    const tx = TEX[C.tex];
    if (tx.synth) {
      for (const [ts, v] of tx.synth.steps) {
        if (ts === s) (tx.synth.voice === "rim" ? rim : tx.synth.voice === "perc" ? perc : (tt: number, vv: number) => hat(tt, false, vv))(t, v * fxv);
      }
    }
    if (tx.lab) {
      for (const ev of tx.lab) {
        if ((ev.b === -1 || ev.b === bar) && ev.s === s) labPlay(ev.snd, t, ev.v * fxv, 1, 0.12);
      }
    }

    /* playhead */
    const c = audio();
    window.setTimeout(() => { if (playingRef.current) { setUiStep(i); paintPlayhead(i); } },
      Math.max(0, (t - c.currentTime) * 1000));
  };

  const tick = () => {
    const c = audio();
    const mag = Math.abs(rate.current);
    /* holding the platter still stops the record, exactly like vinyl */
    if (mag < 0.06) {
      sched.current.nextT = Math.max(sched.current.nextT, c.currentTime + 0.02);
      return;
    }
    const stepDur = 60 / cfgRef.current.bpm / 4 / mag;
    const dir = (rate.current < 0 ? -1 : 1) * (reverse.current ? -1 : 1);
    while (sched.current.nextT < c.currentTime + 0.16) {
      scheduleStep(sched.current.step, sched.current.nextT, stepDur);
      sched.current.step = (sched.current.step + dir + LOOP_STEPS) % LOOP_STEPS;
      sched.current.nextT += stepDur;
    }
  };

  /* The disc spins at 60fps and the readout tracks every pointer move. Both are
     written straight to the DOM: routing them through React state would re-render
     this whole page (every chip, the 64-cell grid, all the sliders) each frame. */
  const paintDisc = () => {
    if (discRef.current) discRef.current.style.transform = `rotate(${spin.current}deg)`;
  };

  /* platter: set the signed speed and pitch every sampled voice to match */
  const setRate = (r: number) => {
    rate.current = r;
    setTurntableRate(Math.abs(r) < 0.06 ? 1 : Math.abs(r));
    const v = Math.round(r * 100) / 100;
    if (readRef.current) {
      readRef.current.textContent = v === 0 ? "STOP" : `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}×`;
    }
    discRef.current?.setAttribute("aria-valuenow", String(v));
  };

  const angleOf = (el: HTMLElement, x: number, y: number) => {
    const b = el.getBoundingClientRect();
    return Math.atan2(y - (b.top + b.height / 2), x - (b.left + b.width / 2));
  };

  const platterDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { angle: angleOf(e.currentTarget, e.clientX, e.clientY), at: performance.now() };
    setRate(0); /* grabbing the record stops it */
  };

  const platterMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const a = angleOf(e.currentTarget, e.clientX, e.clientY);
    const now = performance.now();
    let d = a - drag.current.angle;
    while (d > Math.PI) d -= 2 * Math.PI;      // shortest way round
    while (d < -Math.PI) d += 2 * Math.PI;
    const dt = Math.max(16, now - drag.current.at) / 1000;
    /* one turn per bar at normal speed → angular velocity maps straight to rate */
    const barSec = (60 / cfgRef.current.bpm) * 4;
    setRate(Math.max(-2.2, Math.min(2.2, d / dt / ((2 * Math.PI) / barSec))));
    spin.current += (d * 180) / Math.PI;
    paintDisc();
    drag.current = { angle: a, at: now };
  };

  const platterUp = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const from = rate.current;
    const t0 = performance.now();
    const ease = () => {                       // the record spins back up to speed
      const k = Math.min(1, (performance.now() - t0) / 260);
      setRate(from + (1 - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && !drag.current) requestAnimationFrame(ease);
    };
    requestAnimationFrame(ease);
  };

  /* the memoized note grids don't re-render on uiStep — toggle their column
     highlight straight in the DOM (same trick as the platter readout) */
  const paintPlayhead = (i: number) => {
    const swap = (grid: HTMLDivElement | null, prev: number, next: number) => {
      if (!grid) return;
      for (const row of grid.children) {
        if (prev >= 0) row.children[1 + prev]?.classList.remove(styles.cellNow);
        if (next >= 0) row.children[1 + next]?.classList.add(styles.cellNow);
      }
    };
    const prev = lastHead.current;
    swap(melGridRef.current, prev, i);
    swap(bassGridRef.current, prev >= 0 ? prev & 15 : -1, i >= 0 ? i & 15 : -1);
    lastHead.current = i;
  };

  const startLoop = () => {
    const c = audio();
    void unlockAudio();
    setDrumKit(cfgRef.current.kit);
    if (timer.current !== null) window.clearInterval(timer.current);
    sched.current = { step: 0, nextT: c.currentTime + 0.12 };
    setRate(1);
    timer.current = window.setInterval(tick, 30);
    playingRef.current = true;
    live.playing = true;
    setPlaying(true);
  };

  const stopLoop = () => {
    boothJob.current?.cancel();
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    playingRef.current = false;
    live.playing = false;
    setPlaying(false);
    setUiStep(-1);
    paintPlayhead(-1);
  };

  useEffect(() => stopLoop, []);

  /* disc rotation follows the live rate, so it visibly slows, stops and reverses */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = () => {
      const now = performance.now();
      if (!drag.current) {
        spin.current += rate.current * (reverse.current ? -1 : 1) * ((now - last) / 1000) * 180;
        paintDisc();
      }
      last = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  /* ---------------- download: record two loops off the master bus ---------------- */

  const download = () => {
    if (recording) return;
    startLoop(); /* restart from bar 1 so the take is clean */
    const stream = outputStream();
    let rec: MediaRecorder | null = null;
    try {
      const mime = typeof MediaRecorder !== "undefined"
        ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"]
            .find((m) => MediaRecorder.isTypeSupported(m))
        : undefined;
      rec = mime
        ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 192000 })
        : new MediaRecorder(stream);
    } catch {
      try { rec = new MediaRecorder(stream); } catch { rec = null; }
    }
    if (!rec) return;
    const recorder = rec;
    const C = cfgRef.current;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const save = (blob: Blob, ext: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `delulu-${C.genre}-${C.bpm}bpm.${ext}`;
      document.body.appendChild(a); /* Firefox needs the anchor in the DOM */
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 6000);
    };
    recorder.onstop = async () => {
      const type = recorder.mimeType || "audio/webm";
      const raw = new Blob(chunks, { type });
      if (raw.size) {
        /* Re-encode to WAV: .webm audio won't open in QuickTime, Finder preview,
           Windows Media Player or most DAWs — WAV plays everywhere. */
        try {
          const decoded = await audio().decodeAudioData(await raw.arrayBuffer());
          save(encodeWav(decoded), "wav");
        } catch {
          save(raw, type.includes("mp4") ? "m4a" : "webm");
        }
      }
      setRecording(false);
      setRecLeft(0);
    };
    recorder.start(250); /* timeslice: Safari/Firefox deliver data reliably */
    setRecording(true);
    const ms = (60 / C.bpm / 4) * LOOP_STEPS * 2 * 1000 + 400; /* 8 bars + tail */
    setRecLeft(Math.ceil(ms / 1000));
    const iv = window.setInterval(() => setRecLeft((v) => Math.max(0, v - 1)), 1000);
    window.setTimeout(() => { window.clearInterval(iv); recorder.stop(); }, ms);
  };

  /* ---------------- voice booth: record a 4-bar take over the beat ---------------- */

  const recordVoice = async () => {
    if (boothJob.current) return;
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        /* echo cancellation strips the beat bleeding from speakers into the mic;
           suppression/AGC stay off so singing isn't garbled or pumped */
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      setBoothErr("Mic blocked — allow microphone access and try again.");
      return;
    }
    setBoothErr("");
    if (!playingRef.current) startLoop();
    setRate(1); /* a clean take needs the record at full speed */
    const c = audio();
    let rec: MediaRecorder;
    try {
      const mime = typeof MediaRecorder !== "undefined"
        ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"]
            .find((m2) => MediaRecorder.isTypeSupported(m2))
        : undefined;
      rec = mime ? new MediaRecorder(mic, { mimeType: mime }) : new MediaRecorder(mic);
    } catch {
      mic.getTracks().forEach((tr) => tr.stop());
      setBoothErr("Recording is not supported in this browser.");
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const startCt = c.currentTime;
    rec.start(250);

    /* the take starts on the next bar 1 (at least a beat away) and lasts one loop */
    const C = cfgRef.current;
    const stepDur = 60 / C.bpm / 4;
    const loopSec = stepDur * LOOP_STEPS;
    let t0 = sched.current.nextT + ((LOOP_STEPS - sched.current.step) % LOOP_STEPS) * stepDur;
    while (t0 - c.currentTime < 0.8) t0 += loopSec;

    const timeouts: number[] = [];
    const later = (fn: () => void, atCt: number) =>
      timeouts.push(window.setTimeout(fn, Math.max(0, (atCt - c.currentTime) * 1000)));
    let cancelled = false;
    const cleanup = () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      mic.getTracks().forEach((tr) => tr.stop());
      boothJob.current = null;
    };
    boothJob.current = {
      cancel: () => {
        cancelled = true;
        cleanup();
        try { rec.stop(); } catch { /* already stopped */ }
        setBooth(voiceReady() ? "ready" : "empty");
      },
    };

    setBooth("arming");
    later(() => { setBooth("rec"); setRecBar(1); }, t0);
    for (let b = 1; b < 4; b++) later(() => setRecBar(b + 1), t0 + b * stepDur * 16);

    rec.onstop = async () => {
      if (cancelled) return;
      cleanup();
      try {
        const raw = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const decoded = await c.decodeAudioData(await raw.arrayBuffer());
        /* the singer times to what they hear, which lags by the output latency —
           shift the trim window later by the same amount to line the take up */
        const latency = c.outputLatency || c.baseLatency || 0;
        const clip = trimBuffer(decoded, t0 - startCt + latency, loopSec);
        await saveVoiceClip(clip, C.bpm);
        set({ voiceOn: true });
        setBooth("ready");
        uiBlip(784, 0.06);
      } catch {
        setBooth(voiceReady() ? "ready" : "empty");
        setBoothErr("Couldn't process that take — try again.");
      }
    };
    later(() => { try { rec.stop(); } catch { /* noop */ } }, t0 + loopSec + 0.25);
  };

  useEffect(() => {
    recVoiceRef.current = () => { void recordVoice(); };
  });

  const clearBooth = () => {
    boothJob.current?.cancel();
    void clearVoiceClip();
    set({ voiceOn: false });
    setBooth("empty");
    uiBlip(392, 0.04);
  };

  /* ---------------- helpers ---------------- */

  const pickGenre = (genre: Genre) => {
    boothJob.current?.cancel();
    setCfg((c) => ({ ...defaults(genre, c.key), voiceOn: c.voiceOn, voiceFx: c.voiceFx }));
    if (playingRef.current) window.setTimeout(startLoop, 40);
  };

  const surprise = () => {
    const g = cfgRef.current.genre;
    const GG = GENRES[g];
    const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
    const drums = pick(GG.drums);
    const bassPat = pick(GG.bass);
    const mel = pick(GG.mels);
    set({
      bpm: GG.bpm[0] + Math.round(Math.random() * (GG.bpm[1] - GG.bpm[0])),
      kit: pick(GG.kits), drums, grid: gridOf(drums),
      bassPat, bassSteps: bassStepsOf(bassPat), prog: pick(GG.progs), style: pick(GG.styles),
      voice: pick([GG.voice, ...VOICES.map((v) => v.id)]),
      mel, melNotes: melNotesOf(mel), melVoice: pick(VOICES.map((v) => v.id)),
      chop: pick(GG.chops), tex: pick(GG.tex),
    });
    uiBlip(784, 0.06);
  };

  const toggleCell = (row: number, col: number) => {
    const grid = cfg.grid.map((r) => [...r]);
    grid[row][col] = !grid[row][col];
    set({ grid, drums: "custom" });
    if (grid[row][col] && !playingRef.current) {
      /* placing a hit while stopped plays that drum, so the grid is audible */
      const t = audio().currentTime + 0.01;
      const GG = GENRES[cfg.genre];
      if (row === 0) kick(t, 0.85);
      else if (row === 1) (GG.backVoice === "snare" ? snare : clap)(t, 0.65);
      else if (row === 2) hat(t, false, 0.28);
      else if (GG.auxVoice === "open") hat(t, true, 0.26);
      else if (GG.auxVoice === "rim") rim(t, 0.45);
      else perc(t, 0.45);
    }
  };

  /* stable identities so the memoized grids skip playback re-renders */
  const toggleMel = useCallback((idx: number, step: number) => {
    const C = cfgRef.current;
    const has = C.melNotes.some(([s2, i2]) => s2 === step && i2 === idx);
    const melNotes: [number, number][] = has
      ? C.melNotes.filter(([s2, i2]) => !(s2 === step && i2 === idx))
      : [...C.melNotes, [step, idx]];
    setCfg((c) => ({ ...c, mel: "custom", melNotes }));
    if (!has && !playingRef.current)
      stab(audio().currentTime + 0.01, melPitch(C.key, idx), 0.4, C.melVoice, 0.1);
  }, []);

  const toggleBass = useCallback((add: number, step: number) => {
    const C = cfgRef.current;
    const has = C.bassSteps.some(([s2, a2]) => s2 === step && a2 === add);
    const bassSteps: [number, number][] = has
      ? C.bassSteps.filter(([s2, a2]) => !(s2 === step && a2 === add))
      : [...C.bassSteps, [step, add]];
    setCfg((c) => ({ ...c, bassPat: "custom", bassSteps }));
    if (!has && !playingRef.current) {
      const chord = PROGS[C.prog].bars[0];
      const bd = chord.deg >= 8 ? chord.deg - 12 : chord.deg;
      bass(audio().currentTime + 0.01, C.key + bd + add, 0.85);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const idle = !document.activeElement || document.activeElement === document.body;
      if (e.key === " " && idle && !e.repeat) {
        e.preventDefault();
        if (playingRef.current) stopLoop(); else startLoop();
      }
      if ((e.key === "r" || e.key === "R") && idle && !e.repeat && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        recVoiceRef.current();
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
    ...poolAll(G.drums, DRUMS).map((id) => ({ id, label: DRUMS[id].label })),
    ...(cfg.drums === "custom" ? [{ id: "custom", label: "Custom" }] : []),
  ];
  const bassChips = [
    ...poolAll(G.bass, BASS).map((id) => ({ id, label: BASS[id].label })),
    ...(cfg.bassPat === "custom" ? [{ id: "custom", label: "Custom" }] : []),
  ];
  const melChips = [
    ...poolAll(G.mels, MELS).map((id) => ({ id, label: MELS[id].label })),
    ...(cfg.mel === "custom" ? [{ id: "custom", label: "Custom" }] : []),
  ];


  return (
    <>
    <main className={`stage menuStage ${styles.studio}`} style={{ "--acc": G.accent } as AccStyle}>
      <div className={styles.inner}>
        <StaticBlock>
          <header className={styles.head}>
            <h1 className="wordmark">Beat Lab</h1>
            <p className="tagline">
              Stack drums, bass, chords, melody and vocal chops. Everything stays in key,
              including the parts you picked at random. Play it, then take it with you.
            </p>
          </header>
        </StaticBlock>

        <StaticBlock>
          <div className={styles.rowGroup}>
            <Chips label="Genre" items={(Object.keys(GENRES) as Genre[]).map((g) => ({ id: g, label: GENRES[g].label }))}
              active={cfg.genre} onPick={(id) => pickGenre(id as Genre)}
              tips={TIPS.genre} onPreview={previewGenre} onInfo={announce} />
            <Chips label="Key" items={KEYS.map((k) => ({ id: String(k.semi), label: `${k.label}m` }))}
              active={String(cfg.key)} onPick={(id) => set({ key: Number(id) })}
              tips={TIPS.key} onPreview={previewKey} onInfo={announce} />
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
        </StaticBlock>

        <StaticBlock className={styles.transportWrap}>
          <div className={styles.transport}>
            <button className="cta" data-note={523} onClick={() => (playing ? stopLoop() : startLoop())}>
              {playing ? "Stop ■" : "Play ▸"}
            </button>
            <button className="ghost" data-note={440} onClick={surprise}>Surprise me</button>
            <button className="ghost" data-note={392} onClick={download} disabled={recording}>
              {recording ? `Recording… ${recLeft}s` : "Download"}
            </button>
            <div className={styles.barDots} aria-hidden>
              {[0, 1, 2, 3].map((b) => (
                <span key={b} className={playing && uiBar === b ? styles.barNow : ""} />
              ))}
            </div>
          </div>
        </StaticBlock>

        <StaticBlock>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Groove</h2>
            <Chips label="Drums" items={drumChips} active={cfg.drums}
              onPick={(id) => { if (id !== "custom") set({ drums: id, grid: gridOf(id) }); }}
              tips={TIPS.drums} onPreview={previewDrums} onInfo={announce} />
            <Chips label="Kit" items={[...G.kits, ...ALL_KITS.filter((k) => !G.kits.includes(k))].map((k) => ({ id: k, label: k[0].toUpperCase() + k.slice(1) }))}
              active={cfg.kit} onPick={(id) => { set({ kit: id as DrumKitName }); setDrumKit(id as DrumKitName); }}
              tips={TIPS.kit} onPreview={previewKit} onInfo={announce} />
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
        </StaticBlock>

        <StaticBlock>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Harmony</h2>
            <Chips label="Bass" items={bassChips} active={cfg.bassPat}
              onPick={(id) => { if (id !== "custom") set({ bassPat: id, bassSteps: bassStepsOf(id) }); }}
              tips={TIPS.bass} onPreview={previewBass} onInfo={announce} />
            <p className={styles.gridHint}>
              Or draw your own below — Root, 5th and octave re-tune to each bar&apos;s chord automatically,
              so the bassline can&apos;t leave the key. Tap a step to hear it.
            </p>
            <BassGrid steps={cfg.bassSteps} onToggle={toggleBass} gridRef={bassGridRef} />
            <Chips label="Chorus" items={poolAll(G.progs, PROGS).map((id) => ({ id, label: PROGS[id].label }))}
              active={cfg.prog} onPick={(id) => set({ prog: id })}
              tips={TIPS.prog} onPreview={previewProg} onInfo={announce} />
            <div className={styles.row}>
              <span className={styles.rowLabel} />
              <div className={styles.roman}>
                {prog.roman.map((r2, i) => (
                  <span key={i} className={playing && i === uiBar ? styles.romanNow : ""}>{r2}</span>
                ))}
              </div>
            </div>
            <Chips label="Style" items={poolAll(G.styles, CHORD_STYLES).map((id) => ({ id, label: CHORD_STYLES[id].label }))}
              active={cfg.style} onPick={(id) => set({ style: id })}
              tips={TIPS.style} onPreview={previewStyle} onInfo={announce} />
            <Chips label="Voice" items={VOICES.map((v) => ({ id: v.id, label: v.label }))}
              active={cfg.voice} onPick={(id) => set({ voice: id as LeadVoice })}
              tips={TIPS.voice} onPreview={previewChordVoice} onInfo={announce} />
          </section>
        </StaticBlock>

        <StaticBlock>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Flavor</h2>
            <Chips label="Melody" items={melChips} active={cfg.mel}
              onPick={(id) => { if (id !== "custom") set({ mel: id, melNotes: melNotesOf(id) }); }}
              tips={TIPS.mel} onPreview={previewMel} onInfo={announce} />
            <Chips label="Lead" items={VOICES.map((v) => ({ id: v.id, label: v.label }))}
              active={cfg.melVoice} onPick={(id) => set({ melVoice: id as LeadVoice })}
              tips={TIPS.voice} onPreview={previewLeadVoice} onInfo={announce} />
            <p className={styles.gridHint}>
              Or draw your own below — each row is a note of your key (higher rows sit higher),
              left to right runs through bars 1–4. Presets load in as starting points; tap a cell to hear it.
            </p>
            <MelodyGrid notes={cfg.melNotes} keySemi={cfg.key} onToggle={toggleMel} gridRef={melGridRef} />
            <Chips label="Chops" items={poolAll(G.chops, CHOPS).map((id) => ({ id, label: CHOPS[id].label }))}
              active={cfg.chop} onPick={(id) => set({ chop: id })}
              tips={TIPS.chop} onPreview={previewChop} onInfo={announce} />
            <Chips label="Texture" items={poolAll(G.tex, TEX).map((id) => ({ id, label: TEX[id].label }))}
              active={cfg.tex} onPick={(id) => set({ tex: id })}
              tips={TIPS.tex} onPreview={previewTex} onInfo={announce} />
          </section>
        </StaticBlock>

        <StaticBlock>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Booth</h2>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Take</span>
              <div className={styles.chips}>
                <button
                  className={`mode ${booth === "rec" ? styles.recLive : ""}`}
                  data-note={659}
                  disabled={booth === "arming" || booth === "rec"}
                  onClick={() => { void recordVoice(); }}
                >
                  {booth === "arming" ? "Dropping on bar 1…"
                    : booth === "rec" ? `● Recording — bar ${recBar} of 4`
                    : booth === "ready" ? "● Re-record"
                    : "● Record 4 bars"}
                </button>
                {(booth === "arming" || booth === "rec") && (
                  <button className="mode" data-note={392} onClick={() => boothJob.current?.cancel()}>
                    Cancel
                  </button>
                )}
                {booth === "ready" && (
                  <button className="mode" data-note={330} onClick={clearBooth}>Clear</button>
                )}
              </div>
            </div>
            {booth === "ready" && (
              <>
                <Chips label="Voice" items={[{ id: "on", label: "In the mix" }, { id: "off", label: "Muted" }]}
                  active={cfg.voiceOn ? "on" : "off"} onPick={(id) => set({ voiceOn: id === "on" })}
                  tips={TIPS.boothVoice} onInfo={announce} />
                <Chips label="Tone" items={[{ id: "dry", label: "Dry" }, { id: "radio", label: "Radio" }, { id: "echo", label: "Echo" }]}
                  active={cfg.voiceFx} onPick={(id) => set({ voiceFx: id as VoiceFx })}
                  tips={TIPS.tone} onInfo={announce} />
              </>
            )}
            {boothErr && <p className={styles.boothErr} role="alert">{boothErr}</p>}
            <p className={styles.deckHint}>
              Record your own hook or ad-libs over the beat. The take starts on the next
              bar 1, runs 4 bars, then loops with the track — following tempo and the
              platter like everything else. Headphones keep the beat out of the mic.
            </p>
          </section>
        </StaticBlock>

        <StaticBlock>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Deck</h2>
            <div className={styles.deck}>
              <div
                ref={discRef}
                className={styles.platter}
                onPointerDown={platterDown}
                onPointerMove={platterMove}
                onPointerUp={platterUp}
                onPointerCancel={platterUp}
                role="slider"
                aria-label="Turntable — drag to scrub, hold to stop"
                aria-valuenow={1}
                aria-valuemin={-2.2}
                aria-valuemax={2.2}
                tabIndex={0}
              >
                <span className={styles.label} />
                <span className={styles.spindle} />
                <i className={styles.marker} />
              </div>
              <div className={styles.deckSide}>
                <div className={styles.rateRead}>
                  <b ref={readRef}>1.00×</b>
                  <span>{revOn ? "reverse" : "forward"}</span>
                </div>
                <div className={styles.chips}>
                  <button className="mode" aria-pressed={revOn} data-note={330}
                    onClick={() => { reverse.current = !reverse.current; setRevOn(reverse.current); uiBlip(revOn ? 392 : 587, 0.05); }}>
                    Reverse
                  </button>
                  <button className="mode" data-note={880}
                    onPointerDown={() => { labPlay("fx-scratch", audio().currentTime, 0.6); setRate(-1.6); }}
                    onPointerUp={() => setRate(1)}
                    onPointerLeave={() => { if (rate.current < 0) setRate(1); }}>
                    Scratch
                  </button>
                  <button className="mode" data-note={523} onClick={() => setRate(1)}>Reset</button>
                </div>
                <p className={styles.deckHint}>
                  Drag the disc to scrub — spin it forward to speed up, hold it to stop the record,
                  spin it backwards to run the loop in reverse. Let go and it rides back up to speed.
                </p>
              </div>
            </div>
          </section>
        </StaticBlock>

        <StaticBlock>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Mix</h2>
            <div className={styles.mixGrid}>
              {([["drums", "Drums"], ["bass", "Bass"], ["chords", "Chords"], ["mel", "Melody"], ["fx", "FX & Chops"], ["voice", "Your Voice"]] as const).map(([k, label]) => (
                <label key={k} className={styles.mix}>
                  <span>{label} <b>{cfg.mix[k]}</b></span>
                  <input type="range" min={0} max={130} value={cfg.mix[k]}
                    onChange={(e) => set({ mix: { ...cfg.mix, [k]: parseInt(e.target.value, 10) } })} />
                </label>
              ))}
            </div>
          </section>
        </StaticBlock>

        <StaticBlock>
          <div className="kbd">
            <span><b>Space</b>play / stop</span>
            <span><b>Esc</b>stop</span>
            <span><b>R</b>record voice</span>
            <span><b>F</b>fullscreen</span>
          </div>
        </StaticBlock>
      </div>
    </main>
    {/* outside <main>: the stage's transform would trap position:fixed */}
    <p ref={(el) => { infoEl = el; }} className={styles.infoBar} data-on="0" aria-live="polite" />
    </>
  );
}
