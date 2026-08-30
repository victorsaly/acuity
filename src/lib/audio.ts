"use client";

/**
 * Shared Web Audio engine for all the games.
 *
 * Graph:  source ──► dry ──► compressor ──► destination
 *                └──► reverb send ──► convolver ──► wet ──► compressor
 *
 * The compressor acts as a gentle limiter so overlapping voices
 * (drums + blips + tones) never clip; the convolver adds a short
 * generated room so everything sounds "placed" instead of raw.
 */

let ctx: AudioContext | null = null;
let dry: GainNode;
let wetSend: GainNode;

export function audio(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);

    dry = ctx.createGain();
    dry.gain.value = 0.9;
    dry.connect(comp);

    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 1.6, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    wetSend = ctx.createGain();
    wetSend.connect(convolver);
    convolver.connect(wet);
    wet.connect(comp);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
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
  node.connect(dry);
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

/** Mallet pluck (Echo tiles): soft attack, four partials, the upper ones dying first, wet with reverb. */
export function pluck(freq: number, vol = 0.09, dur = 0.6) {
  const c = audio();
  const t = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const partials: [number, number, OscillatorType, number][] = [
    [1, 1, "sine", 1], [2, 0.32, "sine", 0.55], [3, 0.14, "triangle", 0.3], [4.01, 0.07, "sine", 0.22],
  ];
  for (const [mult, amp, type, life] of partials) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq * mult;
    const pg = c.createGain();
    pg.gain.setValueAtTime(amp, t);
    pg.gain.exponentialRampToValueAtTime(0.0001, t + dur * life);
    o.connect(pg); pg.connect(g);
    o.start(t); o.stop(t + dur + 0.05);
  }
  out(g, 0.45);
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

/* ---------------- drum voices (tempo game) ---------------- */

export type DrumKitName = "punch" | "boom" | "club" | "wood";

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

/* ---------------- sampled kits (one-shots generated by scripts/gen-samples.mjs) ----------------
 *
 * Each kit may have public/samples/<kit>/{kick,snare,hat,open}.mp3. Files are
 * fetched lazily, trimmed of lead-in silence and peak-normalised; any sound
 * that is missing (or not yet loaded) plays through the synth voice below.
 */

type SampleName = "kick" | "snare" | "hat" | "open";
const SAMPLE_NAMES: SampleName[] = ["kick", "snare", "hat", "open"];
type Sample = { buf: AudioBuffer; offset: number; gain: number };
const samples: Partial<Record<DrumKitName, Partial<Record<SampleName, Sample>>>> = {};
const samplesLoading = new Set<DrumKitName>();
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** First moment the sample rises above the noise floor, and 1/peak for normalising. */
function analyse(buf: AudioBuffer): { offset: number; gain: number } {
  const d = buf.getChannelData(0);
  let first = -1, peak = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (first < 0 && a > 0.02) first = i;
    if (a > peak) peak = a;
  }
  return { offset: Math.max(0, first - 8) / buf.sampleRate, gain: peak > 0 ? 0.9 / peak : 1 };
}

export function loadKitSamples(k: DrumKitName = kitName) {
  if (typeof window === "undefined" || samples[k] || samplesLoading.has(k)) return;
  samplesLoading.add(k);
  // Decode on an offline context so preloading never spins up the live
  // AudioContext before the first user gesture.
  const c = ctx ?? new OfflineAudioContext(1, 1, 44100);
  Promise.all(SAMPLE_NAMES.map(async (n) => {
    try {
      const r = await fetch(`${BASE_PATH}/samples/${k}/${n}.mp3`);
      if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("audio")) return null;
      const buf = await c.decodeAudioData(await r.arrayBuffer());
      return [n, { buf, ...analyse(buf) }] as const;
    } catch { return null; }
  })).then((entries) => {
    samples[k] = Object.fromEntries(entries.filter((e): e is NonNullable<typeof e> => !!e));
  }).finally(() => samplesLoading.delete(k));
}

export function preloadAllKits() {
  (Object.keys(KITS) as DrumKitName[]).forEach(loadKitSamples);
}

/** Play a one-shot if its sample exists; returns false so the caller can fall back to synth. */
function playSample(name: SampleName, t: number, vol: number, maxDur: number, reverb: number): boolean {
  const s = samples[kitName]?.[name];
  if (!s) return false;
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = s.buf;
  const g = c.createGain();
  const end = Math.min(maxDur, s.buf.duration - s.offset);
  g.gain.setValueAtTime(vol * s.gain, t);
  g.gain.setValueAtTime(vol * s.gain, t + end * 0.6);
  g.gain.exponentialRampToValueAtTime(0.001, t + end);
  src.connect(g);
  out(g, reverb);
  src.start(t, s.offset);
  src.stop(t + end + 0.02);
  return true;
}

/** Kick: sine with a fast pitch drop + a tiny click transient. */
export function kick(t: number, vol = 0.9) {
  if (playSample("kick", t, vol, 0.6, 0.06)) return;
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

/** Snare: bandpassed noise crack + a tuned body (club kit doubles the crack into a clap). */
export function snare(t: number, vol = 0.7) {
  if (playSample("snare", t, vol * 0.8, 0.45, 0.22)) return;
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

/** Hi-hat: highpassed noise, closed or open (wood kit plays it as a shaker). */
export function hat(t: number, open = false, vol?: number) {
  const K = KITS[kitName];
  if (playSample(open ? "open" : "hat", t, (vol ?? K.hatVol) * 1.3, open ? 0.4 : 0.1, 0.12)) return;
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
