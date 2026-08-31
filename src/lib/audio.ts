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
let ttRate = 1;
let masterBus: GainNode | null = null;
let streamTap: MediaStreamAudioDestinationNode | null = null;
let dryBus: GainNode;
let duckBus: GainNode;
let wetSend: GainNode;

function prime(c: AudioContext) {
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, c.sampleRate);
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(g);
    g.connect(c.destination);
    src.start();
    src.stop(c.currentTime + 0.001);
  } catch {
    /* ignore */
  }
}

/** Turntable speed multiplier — pitch-shifts every sampled voice (drums, chops). */
export function setTurntableRate(r: number) {
  ttRate = Math.max(0.1, Math.min(2.5, Math.abs(r) || 1));
}

/** Current context state — "none" before the context exists. */
export function audioState(): "none" | AudioContextState {
  return ctx ? ctx.state : "none";
}

/**
 * Must be called from inside a real user gesture. WebKit only lifts the
 * mute if resume() and a buffer start happen synchronously on that gesture,
 * so we prime immediately and again once resume() settles.
 */
export function unlockAudio(): Promise<void> {
  const c = audio();
  prime(c);                                  // synchronous, still inside the gesture
  if (c.state !== "suspended") return Promise.resolve();
  return c
    .resume()
    .then(() => { prime(c); })
    .catch(() => {});
}

export function audio(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();

    const master = ctx.createGain();
    master.gain.value = 0.92;
    master.connect(ctx.destination);
    masterBus = master;

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
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
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

/**
 * The audio-clock time of the sound reaching the listener's ears *now*.
 *
 * Rhythm games must schedule and judge on the same clock: `setTimeout` +
 * `performance.now()` drift against `currentTime` by tens of milliseconds,
 * which is most of a scoring window. Notes are scheduled at a `currentTime`
 * in the future, but they are only *heard* one output buffer later, so a
 * perfectly timed tap arrives at `currentTime - outputLatency`. Subtracting
 * it here means a tap compared against the note's scheduled time scores zero
 * error. Safari reports no `outputLatency`; `baseLatency` is the next best
 * estimate, and 0 is a safe floor.
 */
export function heardNow(): number {
  const c = audio();
  const latency = c.outputLatency || c.baseLatency || 0;
  return c.currentTime - latency;
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
  const c = audio();
  const t = c.currentTime;
  const f = freq * 2; // voiced an octave up — bright, glassy
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const o1 = c.createOscillator();
  o1.type = "sine";
  o1.frequency.value = f;
  const o2 = c.createOscillator();
  o2.type = "sine";
  o2.frequency.value = f * 2;
  const g2 = c.createGain();
  g2.gain.value = 0.25;
  const o3 = c.createOscillator();
  o3.type = "triangle";
  o3.frequency.value = f * 3;
  const g3 = c.createGain();
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

export type DrumKitName = "punch" | "boom" | "club" | "wood" | "808" | "lofi";
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
  "808": { kickStart: 130, kickEnd: 34, kickDecay: 0.6,  snareFreq: 2500, snareBody: 220, hatHp: 9000, hatVol: 0.26 },
  lofi:  { kickStart: 100, kickEnd: 40, kickDecay: 0.34, snareFreq: 1500, snareBody: 160, hatHp: 5600, hatVol: 0.16 },
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
  src.playbackRate.value = rate * ttRate * Math.pow(2, cents / 1200);
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
  if (vol <= 0.001) return; /* muted — exponential ramps can't target 0 */
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
  if (vol <= 0.001) return; /* muted — exponential ramps can't target 0 */
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

export type LeadVoice = "piano" | "pluck" | "saw" | "steel" | "brass"
  | "sax" | "rhodes" | "organ" | "guitar" | "bell";

/**
 * One melodic stab for song-mode hooks — synthesized, so every hook is an
 * original rendition. `midi` is a MIDI note number (69 = A4).
 */
export function stab(t: number, midi: number, dur = 0.3, voice: LeadVoice = "piano", vol = 0.16) {
  if (vol <= 0.001) return; /* muted — exponential ramps can't target 0 */
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
  } else if (voice === "sax") {
    /* reedy: saw+square through a moving formant-ish bandpass, with vibrato */
    mk("sawtooth", 1, 0.55); mk("square", 1, 0.3, 6); mk("sawtooth", 2, 0.12);
    lpf.type = "bandpass";
    lpf.Q.value = 1.4;
    lpf.frequency.setValueAtTime(f * 1.4, t);
    lpf.frequency.linearRampToValueAtTime(f * 3.2, t + 0.09);
    lpf.frequency.setTargetAtTime(f * 2.4, t + 0.14, 0.2);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.045);   // breathy, slower attack
    const lfo = c.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 5.4;
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.18);  // vibrato blooms in
    lfo.connect(lg);
    oscs.forEach((o) => lg.connect(o.frequency));
    oscs.push(lfo);
    rel = 0.14;
  } else if (voice === "rhodes") {
    /* electric piano: sine body + a fast-decaying bell tine on top */
    mk("sine", 1, 1); mk("sine", 2, 0.3); mk("sine", 4.02, 0.5); mk("triangle", 7, 0.05);
    lpf.frequency.setValueAtTime(f * 8, t);
    lpf.frequency.exponentialRampToValueAtTime(f * 2, t + Math.max(0.12, dur * 0.5));
    g.gain.setTargetAtTime(vol * 0.3, t + 0.02, Math.max(0.12, dur * 0.55));
    rel = 0.13;
  } else if (voice === "organ") {
    /* drawbar organ: pure additive, near-flat sustain — classic house stab */
    mk("sine", 1, 0.9); mk("sine", 2, 0.55); mk("sine", 3, 0.32);
    mk("sine", 4, 0.22); mk("sine", 6, 0.12); mk("sine", 8, 0.08);
    lpf.frequency.value = Math.min(13000, f * 14);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    rel = 0.05;
  } else if (voice === "guitar") {
    /* plucked string: detuned saws through a fast-closing lowpass */
    mk("sawtooth", 1, 0.6, -5); mk("sawtooth", 1, 0.5, 6); mk("triangle", 2, 0.18);
    lpf.frequency.setValueAtTime(f * 9, t);
    lpf.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.22);
    g.gain.setTargetAtTime(vol * 0.28, t + 0.015, Math.max(0.1, dur * 0.45));
    rel = 0.1;
  } else if (voice === "bell") {
    /* inharmonic partials — glassy trap bell */
    mk("sine", 1, 1); mk("sine", 2.76, 0.4); mk("sine", 5.4, 0.18); mk("sine", 8.9, 0.07);
    lpf.frequency.value = Math.min(14000, f * 16);
    g.gain.setTargetAtTime(vol * 0.2, t + 0.01, Math.max(0.14, dur * 0.5));
    rel = 0.22;
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

/* ---------------- output tap (Beat Lab recording) ---------------- */

/** A MediaStream carrying the master output, for MediaRecorder capture. */
export function outputStream(): MediaStream {
  const c = audio();
  if (!streamTap) {
    streamTap = c.createMediaStreamDestination();
    masterBus!.connect(streamTap);
  }
  return streamTap.stream;
}

/* ---------------- Beat Lab pack (vocal chops, FX, textures) ----------------
 *
 * ElevenLabs one-shots rendered by scripts/gen-lab.mjs into
 * public/samples/lab/.  Deliberately atonal roles only — tonal layers stay
 * synthesized so they are always in key.  Missing files fail silently.
 */

export const LAB_SOUNDS = [
  "vox-hey", "vox-oh", "vox-yeah", "vox-uh", "vox-la", "vox-chant",
  "fx-riser", "fx-drop", "fx-vinyl", "fx-sweep", "fx-scratch", "fx-air",
  "vox-woo", "vox-aah", "vox-diva", "vox-huh", "vox-mmm", "vox-hoo",
  "fx-horn", "fx-rewind",
] as const;
export type LabSound = (typeof LAB_SOUNDS)[number];

const labBufs: Partial<Record<LabSound, AudioBuffer>> = {};
let labLoading = false;

export function loadLabSamples() {
  if (typeof window === "undefined" || labLoading) return;
  labLoading = true;
  const c = ctx ?? new OfflineAudioContext(1, 1, 44100);
  LAB_SOUNDS.forEach(async (name) => {
    try {
      const r = await fetch(`${BASE_PATH}/samples/lab/${name}.mp3`);
      if (!r.ok) return;
      labBufs[name] = await c.decodeAudioData(await r.arrayBuffer());
    } catch { /* not generated yet */ }
  });
}

export function labReady(name: LabSound): boolean {
  return !!labBufs[name];
}

/** Play one lab sample; false (silently) if it is not loaded. */
export function labPlay(name: LabSound, t: number, vol = 0.5, rate = 1, send = 0.3): boolean {
  const buf = labBufs[name];
  if (!buf) return false;
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * ttRate;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g);
  out(g, send);
  src.start(t);
  return true;
}

/* ---------------- voice booth (Beat Lab: record your own voice) ----------------
 *
 * One 4-bar take captured from the mic, trimmed to the loop on the audio
 * clock, then looped like any other layer.  playbackRate rescales the take
 * when the tempo (or the platter) changes so it always fits the bar, and the
 * clip is persisted to IndexedDB as WAV so it survives reloads.
 */

export type VoiceFx = "dry" | "radio" | "echo";

let voiceBuf: AudioBuffer | null = null;
let voiceBpm = 0;

export function voiceReady(): boolean {
  return !!voiceBuf;
}

export function setVoiceClip(buf: AudioBuffer | null, bpm: number) {
  voiceBuf = buf;
  voiceBpm = bpm;
}

/** Loop-synced playback of the booth take; false (silently) when there is none. */
export function voicePlay(t: number, vol: number, fx: VoiceFx, bpmNow: number): boolean {
  if (!voiceBuf || !voiceBpm) return false;
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = voiceBuf;
  const rate = (bpmNow / voiceBpm) * ttRate;
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = vol;
  let head: AudioNode = src;
  if (fx === "radio") {
    /* small-speaker squeeze: bandpass + highpass */
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1500;
    bp.Q.value = 0.9;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 380;
    head.connect(bp);
    bp.connect(hp);
    head = hp;
  }
  head.connect(g);
  out(g, fx === "dry" ? 0.14 : 0.2);
  if (fx === "echo") {
    /* dotted-eighth feedback delay, faded out after the take so the cycle dies */
    const d = c.createDelay(1.5);
    d.delayTime.value = Math.min(1.4, 0.75 * (60 / bpmNow));
    const fb = c.createGain();
    const dur = voiceBuf.duration / rate;
    fb.gain.setValueAtTime(0.34, t);
    fb.gain.linearRampToValueAtTime(0, t + dur + 2.5);
    const wet = c.createGain();
    wet.gain.value = 0.38 * vol;
    g.connect(d);
    d.connect(fb);
    fb.connect(d);
    d.connect(wet);
    out(wet, 0.3);
  }
  src.start(t);
  return true;
}

/** Cut `seconds` out of a decoded take starting at `offset` (both in seconds). */
export function trimBuffer(src: AudioBuffer, offset: number, seconds: number): AudioBuffer {
  const rate = src.sampleRate;
  const len = Math.max(1, Math.round(seconds * rate));
  const from = Math.max(0, Math.round(offset * rate));
  const chans = Math.max(1, Math.min(2, src.numberOfChannels));
  const c = ctx ?? new OfflineAudioContext(1, 1, 44100);
  const outBuf = c.createBuffer(chans, len, rate);
  for (let ch = 0; ch < chans; ch++) {
    const s = src.getChannelData(Math.min(ch, src.numberOfChannels - 1));
    const d = outBuf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = from + i < s.length ? s[from + i] : 0;
  }
  return outBuf;
}

/* the clip survives reloads: WAV blob + its tempo in IndexedDB */
const VOICE_DB = "dialed-lab";
const VOICE_STORE = "voice";

function voiceDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(VOICE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(VOICE_STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function saveVoiceClip(buf: AudioBuffer, bpm: number): Promise<void> {
  setVoiceClip(buf, bpm);
  try {
    const db = await voiceDb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(VOICE_STORE, "readwrite");
      tx.objectStore(VOICE_STORE).put({ wav: encodeWav(buf), bpm }, "clip");
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch { /* no persistence — the take still plays this session */ }
}

export async function clearVoiceClip(): Promise<void> {
  setVoiceClip(null, 0);
  try {
    const db = await voiceDb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(VOICE_STORE, "readwrite");
      tx.objectStore(VOICE_STORE).delete("clip");
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch { /* nothing stored */ }
}

export async function loadVoiceClip(): Promise<boolean> {
  if (voiceBuf) return true;
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await voiceDb();
    const rec = await new Promise<{ wav: Blob; bpm: number } | undefined>((res, rej) => {
      const tx = db.transaction(VOICE_STORE, "readonly");
      const rq = tx.objectStore(VOICE_STORE).get("clip");
      rq.onsuccess = () => res(rq.result as { wav: Blob; bpm: number } | undefined);
      rq.onerror = () => rej(rq.error);
    });
    db.close();
    if (!rec?.wav || !rec.bpm) return false;
    const c = ctx ?? new OfflineAudioContext(1, 1, 44100);
    const buf = await c.decodeAudioData(await rec.wav.arrayBuffer());
    setVoiceClip(buf, rec.bpm);
    return true;
  } catch {
    return false;
  }
}

/** Encode an AudioBuffer as a 16-bit PCM WAV blob — plays in every player. */
export function encodeWav(buf: AudioBuffer): Blob {
  const chans = Math.min(2, buf.numberOfChannels);
  const len = buf.length;
  const bytes = 44 + len * chans * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const str = (off: number, t: string) => {
    for (let i = 0; i < t.length; i++) view.setUint8(off + i, t.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, bytes - 8, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);          // PCM header size
  view.setUint16(20, 1, true);           // format: PCM
  view.setUint16(22, chans, true);
  view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * chans * 2, true);
  view.setUint16(32, chans * 2, true);
  view.setUint16(34, 16, true);          // bits per sample
  str(36, "data");
  view.setUint32(40, len * chans * 2, true);

  const data = Array.from({ length: chans }, (_, c) => buf.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < chans; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}
