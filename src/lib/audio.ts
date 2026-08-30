"use client";

/**
 * Shared Web Audio engine for all the games.
 *
 * Master chain (every voice runs through it, so the whole app is "glued"):
 *
 *   voices ──► dry bus ─────────┐
 *   hats/bass ► duck bus ───────┼──► saturator ─► glue comp ─► limiter ─► master ─► out
 *   per-voice sends ► convolver ┘    (tanh 1.8,   (-20dB 2.6:1)  (-1.5dB
 *                                     2x overs.)                  20:1)
 *
 * The saturator adds harmonic weight, the glue compressor makes the layers
 * breathe together, and the limiter catches peaks so nothing ever clips.
 * The duck bus dips ~4dB for 60ms whenever a kick lands — the sidechain
 * "pump" of a produced record.  A generated-noise convolver gives a short
 * room on a per-voice send.
 *
 * Drum voices are pre-rendered one-shots (scripts/kits/build.py) listed in
 * public/samples/manifest.json — 2-3 round-robin variants per voice, played
 * with ±6 cent / ±0.5dB humanisation.  Until they finish loading, a synth
 * fallback covers every voice.
 */

let ctx: AudioContext | null = null;
let dryBus: GainNode;
let duckBus: GainNode;
let wetSend: GainNode;

export function audio(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();

    const master = ctx.createGain();
    master.gain.value = 0.92;
    master.connect(ctx.destination);

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.08;
    limiter.connect(master);

    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20;
    glue.knee.value = 8;
    glue.ratio.value = 2.6;
    glue.attack.value = 0.006;
    glue.release.value = 0.18;
    glue.connect(limiter);

    const shaper = ctx.createWaveShaper();
    shaper.curve = satCurve(1.8);
    shaper.oversample = "2x";
    shaper.connect(glue);

    dryBus = ctx.createGain();
    dryBus.connect(shaper);
    duckBus = ctx.createGain();
    duckBus.connect(shaper);

    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 1.5, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.8;
    wetSend = ctx.createGain();
    wetSend.connect(convolver);
    convolver.connect(wet);
    wet.connect(shaper);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function satCurve(drive: number) {
  const n = 2048;
  const curve = new Float32Array(n);
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

/** Exponentially decaying stereo noise — a small, soft room. */
function makeImpulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = c.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = c.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function out(node: AudioNode, reverbAmount = 0.15) {
  node.connect(dryBus);
  if (reverbAmount > 0) {
    const send = ctx!.createGain();
    send.gain.value = reverbAmount;
    node.connect(send);
    send.connect(wetSend);
  }
}

export function now(): number {
  return audio().currentTime;
}

/** Sidechain pump: dip the duck bus when a kick lands. */
function duck(t: number, amount: number) {
  if (!ctx || amount <= 0) return;
  const g = duckBus.gain;
  const t0 = Math.max(t, ctx.currentTime);
  g.cancelScheduledValues(t0);
  g.setTargetAtTime(1 - amount, t0, 0.006);
  g.setTargetAtTime(1, t0 + 0.055, 0.085);
}

/* ---------------- UI blips ---------------- */

/** Crisp rollover/click blip: sine fundamental + octave and 3rd-harmonic sparkle, fast attack. */
export function uiBlip(freq = 587, vol = 0.05, dur = 0.07) {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;
  const f = freq * 2; // voiced an octave up — bright, glassy
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const o1 = ctx.createOscillator();
  o1.type = "sine";
  o1.frequency.value = f;
  const o2 = ctx.createOscillator();
  o2.type = "sine";
  o2.frequency.value = f * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.25;
  const o3 = ctx.createOscillator();
  o3.type = "triangle";
  o3.frequency.value = f * 3;
  const g3 = ctx.createGain();
  g3.gain.value = 0.08;
  o2.connect(g2);
  o3.connect(g3);
  o1.connect(g);
  g2.connect(g);
  g3.connect(g);
  out(g, 0.35);
  o1.start(t); o2.start(t); o3.start(t);
  o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1); o3.stop(t + dur + 0.1);
}

/** Wrong-answer thud: a low sawtooth pitch-drop through a closing lowpass. */
export function buzz() {
  const c = audio();
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(95, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.22);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + 0.25);
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  o.connect(lp); lp.connect(g);
  out(g, 0.15);
  o.start(t); o.stop(t + 0.3);
}

/* ---------------- sustained tone (sound game) ---------------- */

export type ToneVoice = "pure" | "warm" | "organ" | "chip";

const TONE_DEFS: Record<ToneVoice, {
  partials: { mult: number; gain: number; type: OscillatorType }[];
  filterMult: number;
}> = {
  pure: { partials: [{ mult: 1, gain: 1, type: "sine" }], filterMult: 12 },
  warm: {
    partials: [
      { mult: 1, gain: 1, type: "sine" },
      { mult: 2, gain: 0.1, type: "triangle" },
    ],
    filterMult: 12,
  },
  organ: {
    partials: [
      { mult: 1, gain: 0.85, type: "sine" },
      { mult: 2, gain: 0.35, type: "sine" },
      { mult: 3, gain: 0.18, type: "sine" },
      { mult: 4, gain: 0.1, type: "sine" },
    ],
    filterMult: 14,
  },
  chip: { partials: [{ mult: 1, gain: 0.35, type: "square" }], filterMult: 8 },
};

let toneVoice: ToneVoice = "warm";
let builtVoice: ToneVoice | null = null;
let toneOscs: OscillatorNode[] = [];
let toneMults: number[] = [];
let toneGain: GainNode | null = null;
let toneFilter: BiquadFilterNode | null = null;

export function setToneVoice(v: ToneVoice) {
  toneVoice = v; // rebuilt lazily on the next toneOn
}

function buildToneVoice(c: AudioContext) {
  toneOscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } o.disconnect(); });
  toneOscs = [];
  toneMults = [];
  if (!toneGain) {
    toneGain = c.createGain();
    toneGain.gain.value = 0;
    toneFilter = c.createBiquadFilter();
    toneFilter.type = "lowpass";
    toneFilter.connect(toneGain);
    out(toneGain, 0.18);
  }
  for (const p of TONE_DEFS[toneVoice].partials) {
    const o = c.createOscillator();
    o.type = p.type;
    const g = c.createGain();
    g.gain.value = p.gain;
    o.connect(g);
    g.connect(toneFilter!);
    o.start();
    toneOscs.push(o);
    toneMults.push(p.mult);
  }
  builtVoice = toneVoice;
}

function toneSetFreq(freq: number, t: number) {
  toneOscs.forEach((o, i) => o.frequency.setTargetAtTime(freq * toneMults[i], t, 0.008));
  toneFilter!.frequency.setTargetAtTime(
    Math.min(freq * TONE_DEFS[toneVoice].filterMult, 13000), t, 0.02,
  );
}

export function toneOn(freq: number) {
  const c = audio();
  if (builtVoice !== toneVoice) buildToneVoice(c);
  const t = c.currentTime;
  toneSetFreq(freq, t);
  toneGain!.gain.cancelScheduledValues(t);
  toneGain!.gain.setTargetAtTime(0.085, t, 0.015);   // quieter — it's on continuously while you tune
}

export function toneGlide(freq: number) {
  if (!ctx || builtVoice === null) return;
  toneSetFreq(freq, ctx.currentTime);
}

export function toneOff() {
  if (!ctx || !toneGain) return;
  const t = ctx.currentTime;
  toneGain.gain.cancelScheduledValues(t);
  toneGain.gain.setTargetAtTime(0, t, 0.05);
}

export function toneActive(): boolean {
  return !!toneGain && toneGain.gain.value > 0.004;
}

/* ---------------- drum kits (tempo game) ---------------- */

export type DrumKitName = "punch" | "boom" | "club" | "wood";
export type DrumVoice = "kick" | "snare" | "clap" | "hat" | "open" | "rim" | "perc" | "bass";

const KITS: Record<DrumKitName, {
  kickStart: number; kickEnd: number; kickDecay: number;
  snareFreq: number; snareBody: number; clap?: boolean;
  hatHp: number; hatVol: number; shaker?: boolean;
}> = {
  punch: { kickStart: 160, kickEnd: 44, kickDecay: 0.28, snareFreq: 2300, snareBody: 210, hatHp: 8600, hatVol: 0.24 },
  boom:  { kickStart: 115, kickEnd: 36, kickDecay: 0.48, snareFreq: 1750, snareBody: 175, hatHp: 7000, hatVol: 0.19 },
  club:  { kickStart: 210, kickEnd: 52, kickDecay: 0.17, snareFreq: 2900, snareBody: 250, clap: true, hatHp: 9600, hatVol: 0.3 },
  wood:  { kickStart: 95,  kickEnd: 68, kickDecay: 0.12, snareFreq: 3400, snareBody: 420, hatHp: 6200, hatVol: 0.15, shaker: true },
};

let kitName: DrumKitName = "punch";

export function setDrumKit(k: DrumKitName) {
  kitName = k;
  loadKitSamples(k);
}

/* ---------------- sampled kits (one-shots rendered by scripts/kits/build.py) ----------------
 *
 * public/samples/manifest.json lists, per kit and voice, the round-robin
 * files plus mix gain, reverb send and duck amount.  Files are fetched
 * lazily; any voice not yet loaded plays through the synth fallback.
 */

type VoiceDef = { files: string[]; gain: number; send: number; duck: number };
type Manifest = { bassRoot: number; kits: Record<string, Record<string, VoiceDef>> };

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
let manifest: Manifest | null = null;
let manifestP: Promise<Manifest | null> | null = null;
const samples: Partial<Record<DrumKitName, Partial<Record<DrumVoice, AudioBuffer[]>>>> = {};
const samplesLoading = new Set<DrumKitName>();

function fetchManifest(): Promise<Manifest | null> {
  manifestP ??= fetch(`${BASE_PATH}/samples/manifest.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((m: Manifest | null) => (manifest = m))
    .catch(() => null);
  return manifestP;
}

export function loadKitSamples(k: DrumKitName = kitName) {
  if (typeof window === "undefined" || samples[k] || samplesLoading.has(k)) return;
  samplesLoading.add(k);
  // Decode on an offline context so preloading never spins up the live
  // AudioContext before the first user gesture.
  const c = ctx ?? new OfflineAudioContext(1, 1, 44100);
  fetchManifest().then(async (m) => {
    const kit = m?.kits[k];
    if (!kit) return;
    const loaded: Partial<Record<DrumVoice, AudioBuffer[]>> = {};
    await Promise.all((Object.keys(kit) as DrumVoice[]).map(async (voice) => {
      const bufs = await Promise.all(kit[voice].files.map(async (f) => {
        try {
          const r = await fetch(`${BASE_PATH}/samples/${k}/${f}`);
          if (!r.ok) return null;
          return await c.decodeAudioData(await r.arrayBuffer());
        } catch { return null; }
      }));
      const ok = bufs.filter((b): b is AudioBuffer => !!b);
      if (ok.length) loaded[voice] = ok;
    }));
    samples[k] = loaded;
  }).finally(() => samplesLoading.delete(k));
}

export function preloadAllKits() {
  (Object.keys(KITS) as DrumKitName[]).forEach(loadKitSamples);
}

/* round-robin state: never the same variant twice in a row */
const rrState: Record<string, number> = {};
function nextVariant(key: string, n: number): number {
  if (n < 2) return 0;
  const prev = rrState[key] ?? Math.floor(Math.random() * n);
  const i = (prev + 1 + Math.floor(Math.random() * (n - 1))) % n;
  rrState[key] = i;
  return i;
}

/* choke groups: a closed hat chokes the open hat; a new bass note chokes the last */
let lastOpen: { g: GainNode; src: AudioBufferSourceNode } | null = null;
let lastBass: { g: GainNode; src: AudioBufferSourceNode } | null = null;

function choke(v: { g: GainNode; src: AudioBufferSourceNode } | null, t: number, ms = 0.02) {
  if (!v || !ctx) return;
  const t0 = Math.max(t, ctx.currentTime);
  try {
    v.g.gain.cancelScheduledValues(t0);
    v.g.gain.setValueAtTime(v.g.gain.value, t0);
    v.g.gain.linearRampToValueAtTime(0.0001, t0 + ms);
    v.src.stop(t0 + ms + 0.005);
  } catch { /* already stopped */ }
}

/** Play one sampled voice; null if its buffers aren't ready yet (caller falls back to synth). */
function playVoice(
  voice: DrumVoice, t: number, vol = 1, rate = 1, humanize = true,
): { g: GainNode; src: AudioBufferSourceNode } | null {
  const def = manifest?.kits[kitName]?.[voice];
  const bufs = samples[kitName]?.[voice];
  if (!def || !bufs?.length) return null;
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = bufs[nextVariant(`${kitName}/${voice}`, bufs.length)];
  const cents = humanize ? (Math.random() * 2 - 1) * 6 : 0;
  src.playbackRate.value = rate * Math.pow(2, cents / 1200);
  const g = c.createGain();
  const trim = humanize ? Math.pow(10, ((Math.random() * 2 - 1) * 0.5) / 20) : 1;
  g.gain.value = def.gain * vol * trim;
  src.connect(g);
  g.connect(def.duck > 0 ? duckBus : dryBus);
  if (def.send > 0) {
    const s = c.createGain();
    s.gain.value = def.send;
    g.connect(s);
    s.connect(wetSend);
  }
  src.start(t);
  return { g, src };
}

/** Kick: sampled (with sidechain pump), else sine pitch-drop + click transient. */
export function kick(t: number, vol = 0.9) {
  duck(t, 0.45);
  if (playVoice("kick", t, vol)) return;
  const c = audio();
  const K = KITS[kitName];
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(K.kickStart, t);
  o.frequency.exponentialRampToValueAtTime(K.kickEnd, t + K.kickDecay * 0.4);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + K.kickDecay);
  o.connect(g);
  out(g, 0.08);
  o.start(t); o.stop(t + K.kickDecay + 0.05);

  const click = c.createOscillator();
  click.type = "square";
  click.frequency.value = 1200;
  const cg = c.createGain();
  cg.gain.setValueAtTime(vol * 0.12, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
  click.connect(cg);
  out(cg, 0);
  click.start(t); click.stop(t + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBufferSourceNode {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

function snareBurst(c: AudioContext, t: number, vol: number, freq: number) {
  const n = noise(c);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  n.connect(bp); bp.connect(g);
  out(g, 0.25);
  n.start(t); n.stop(t + 0.2);
}

/** Snare: sampled, else bandpassed noise crack + a tuned body. */
export function snare(t: number, vol = 0.8) {
  if (playVoice("snare", t, vol)) return;
  const c = audio();
  const K = KITS[kitName];
  snareBurst(c, t, vol * 0.5, K.snareFreq);
  if (K.clap) snareBurst(c, t + 0.028, vol * 0.35, K.snareFreq * 0.9);

  const body = c.createOscillator();
  body.type = "triangle";
  body.frequency.setValueAtTime(K.snareBody, t);
  body.frequency.exponentialRampToValueAtTime(K.snareBody * 0.7, t + 0.08);
  const bg = c.createGain();
  bg.gain.setValueAtTime(vol * 0.35, t);
  bg.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  body.connect(bg);
  out(bg, 0.1);
  body.start(t); body.stop(t + 0.12);
}

/** Clap: sampled, else the synth snare's noise crack doubled. */
export function clap(t: number, vol = 0.8) {
  if (playVoice("clap", t, vol)) return;
  const c = audio();
  const K = KITS[kitName];
  snareBurst(c, t, vol * 0.4, K.snareFreq);
  snareBurst(c, t + 0.028, vol * 0.3, K.snareFreq * 0.9);
}

/** Hi-hat: closed chokes open; sampled, else highpassed noise. */
export function hat(t: number, open = false, vol?: number) {
  const K = KITS[kitName];
  if (!open) choke(lastOpen, t);
  const v = playVoice(open ? "open" : "hat", t, vol ?? 1);
  if (v) { if (open) lastOpen = v; return; }
  const c = audio();
  const n = noise(c);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = K.hatHp;
  const g = c.createGain();
  const dur = open ? 0.24 : K.shaker ? 0.09 : 0.045;
  g.gain.setValueAtTime(vol ?? K.hatVol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(hp); hp.connect(g);
  out(g, 0.12);
  n.start(t); n.stop(t + dur + 0.05);
}

/** Rimshot / woodblock accent: sampled, else a short ping. */
export function rim(t: number, vol = 0.8) {
  if (playVoice("rim", t, vol)) return;
  const c = audio();
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.value = 820;
  const g = c.createGain();
  g.gain.setValueAtTime(vol * 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g);
  out(g, 0.18);
  o.start(t); o.stop(t + 0.07);
}

/** Percussion (cowbell / conga / tom flavor per kit): sampled, else a tuned blip. */
export function perc(t: number, vol = 0.8) {
  if (playVoice("perc", t, vol)) return;
  const c = audio();
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(240, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.08);
  const g = c.createGain();
  g.gain.setValueAtTime(vol * 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g);
  out(g, 0.2);
  o.start(t); o.stop(t + 0.14);
}

/** Bass note, in semitones from the kit's root (F1). Mono — a new note chokes the last. */
export function bass(t: number, semis = 0, vol = 1) {
  choke(lastBass, t, 0.015);
  const rate = Math.pow(2, semis / 12);
  const v = playVoice("bass", t, vol, rate, false);
  if (v) { lastBass = v; return; }
  const m = manifest?.bassRoot ?? 43.65;
  const c = audio();
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.value = m * rate;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g);
  g.connect(duckBus);
  o.start(t); o.stop(t + 0.45);
}

/** Soft mallet pluck (memory game): sine + faint octave through a closing lowpass. */
export function pluck(freq: number, vol = 0.06, dur = 0.4) {
  const c = audio();
  const t = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lpf = c.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.setValueAtTime(freq * 8, t);
  lpf.frequency.exponentialRampToValueAtTime(freq * 2, t + dur * 0.7);
  const o1 = c.createOscillator();
  o1.type = "sine";
  o1.frequency.value = freq;
  const o2 = c.createOscillator();
  o2.type = "triangle";
  o2.frequency.value = freq * 2;
  const g2 = c.createGain();
  g2.gain.value = 0.22;
  o2.connect(g2);
  o1.connect(lpf);
  g2.connect(lpf);
  lpf.connect(g);
  out(g, 0.3);
  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

/* ---------------- melodic stabs (song hooks) ---------------- */

export type LeadVoice = "piano" | "pluck" | "saw" | "steel" | "brass";

/**
 * One melodic stab for song-mode hooks — synthesized, so every hook is an
 * original rendition. `midi` is a MIDI note number (69 = A4).
 */
export function stab(t: number, midi: number, dur = 0.3, voice: LeadVoice = "piano", vol = 0.16) {
  const c = audio();
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  const lpf = c.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.connect(g);
  const oscs: OscillatorNode[] = [];
  const mk = (type: OscillatorType, mult: number, gain: number, detune = 0) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f * mult;
    o.detune.value = detune;
    const og = c.createGain();
    og.gain.value = gain;
    o.connect(og);
    og.connect(lpf);
    oscs.push(o);
  };
  let rel = 0.08;                    // release tail after dur
  if (voice === "piano") {
    mk("triangle", 1, 1); mk("triangle", 2, 0.35, 4); mk("sine", 4, 0.12);
    lpf.frequency.setValueAtTime(f * 9, t);
    lpf.frequency.exponentialRampToValueAtTime(f * 2.5, t + Math.max(0.1, dur));
    g.gain.setTargetAtTime(vol * 0.35, t + 0.02, Math.max(0.1, dur * 0.6));
  } else if (voice === "pluck") {
    mk("sawtooth", 1, 0.7); mk("sine", 1, 0.5);
    lpf.frequency.setValueAtTime(f * 7, t);
    lpf.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.12);
    rel = 0.05;
  } else if (voice === "saw") {
    mk("sawtooth", 1, 0.5, -7); mk("sawtooth", 1, 0.5, 7); mk("sawtooth", 0.5, 0.25);
    lpf.frequency.setValueAtTime(f * 3, t);
    lpf.frequency.linearRampToValueAtTime(f * 8, t + 0.05);
    lpf.frequency.setTargetAtTime(f * 3.5, t + 0.08, 0.15);
    rel = 0.1;
  } else if (voice === "steel") {
    mk("sine", 1, 1); mk("sine", 2.02, 0.45); mk("sine", 2.9, 0.25); mk("triangle", 3.98, 0.12);
    lpf.frequency.value = Math.min(12000, f * 12);
    g.gain.setTargetAtTime(vol * 0.25, t + 0.015, Math.max(0.09, dur * 0.5));
    rel = 0.12;
  } else {                            // brass
    mk("sawtooth", 1, 0.6); mk("square", 1, 0.25, 5); mk("sawtooth", 2, 0.15);
    lpf.frequency.setValueAtTime(f * 2, t);
    lpf.frequency.linearRampToValueAtTime(f * 6, t + 0.06);
    rel = 0.09;
  }
  const end = t + dur;
  g.gain.cancelScheduledValues(end);
  g.gain.setValueAtTime(vol * 0.4, end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
  out(g, 0.24);
  oscs.forEach((o) => { o.start(t); o.stop(end + rel + 0.05); });
}

/** Count-in / metronome click. */
export function click(t: number, accent = false, freq?: number) {
  const c = audio();
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.value = freq ?? (accent ? 2093 : 1397);
  const g = c.createGain();
  g.gain.setValueAtTime(accent ? 0.22 : 0.14, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o.connect(g);
  out(g, 0.2);
  o.start(t); o.stop(t + 0.1);
}

/** One-shot pitched blip used for results playback. */
export function playTone(freq: number, ms = 700) {
  toneOn(freq);
  window.clearTimeout((playTone as unknown as { t?: number }).t);
  (playTone as unknown as { t?: number }).t = window.setTimeout(() => toneOff(), ms);
}

/* ---------------- piano key (Refrain) ---------------- */

/** Piano-ish key: hammer-noise transient + slightly inharmonic partials,
 *  the upper ones dying first. Higher notes decay a touch faster. */
export function pianoKey(freq: number, vol = 0.14, dur?: number) {
  const c = audio();
  const t = c.currentTime;
  const life = dur ?? Math.max(0.5, 1.15 - (freq - 261) / 1600);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + life);
  const partials: [number, number, OscillatorType, number][] = [
    [1, 1, "sine", 1],
    [2.001, 0.44, "sine", 0.62],
    [2.997, 0.2, "sine", 0.38],
    [4.19, 0.09, "triangle", 0.24],
    [5.42, 0.045, "sine", 0.14],
  ];
  for (const [mult, amp, type, part] of partials) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq * mult;
    const pg = c.createGain();
    pg.gain.setValueAtTime(amp, t);
    pg.gain.exponentialRampToValueAtTime(0.0001, t + life * part);
    o.connect(pg); pg.connect(g);
    o.start(t); o.stop(t + life + 0.05);
  }
  out(g, 0.5);

  // hammer: a tiny bandpassed noise thump right at the attack
  const n = noise(c);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = Math.min(freq * 6, 4200);
  bp.Q.value = 1.1;
  const ng = c.createGain();
  ng.gain.setValueAtTime(vol * 0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  n.connect(bp); bp.connect(ng);
  out(ng, 0.2);
  n.start(t); n.stop(t + 0.05);
}
