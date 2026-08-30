#!/usr/bin/env node
/**
 * Generate drum one-shots for each kit with the ElevenLabs Sound Effects API.
 *
 *   ELEVENLABS_API_KEY=... npm run samples            # all kits, skips existing files
 *   npm run samples -- --kit club                     # one kit
 *   npm run samples -- --force                        # regenerate everything
 *
 * The key is read from the environment or from .env.local (ELEVENLABS_API_KEY=...).
 * Output: public/samples/<kit>/{kick,snare,hat,open}.mp3
 */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "samples");
const API = "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128";

const KITS = {
  punch: {
    kick:  "punchy tight electronic kick drum, single hit, dry, no reverb, short",
    snare: "tight snappy electronic snare drum, single hit, dry, no reverb",
    hat:   "closed hi-hat, single crisp tick, dry, very short",
    open:  "open hi-hat, single hit, short sizzle decay, dry",
  },
  boom: {
    kick:  "deep 808 sub bass kick drum, single hit, long boom, dry",
    snare: "dusty boom bap hip hop snare drum, single hit, vinyl texture, dry",
    hat:   "lo-fi closed hi-hat, single tick, dusty, dry, very short",
    open:  "lo-fi open hi-hat, single hit, short decay, dry",
  },
  club: {
    kick:  "hard house music kick drum, single hit, punchy, tight, dry",
    snare: "layered hand clap, single hit, club sound, dry, tight",
    hat:   "bright closed hi-hat, single tick, crisp, dry, very short",
    open:  "bright open hi-hat, single hit, short decay, dry",
  },
  wood: {
    kick:  "acoustic bass drum, single soft hit, close mic, dry, wooden",
    snare: "acoustic snare rimshot, single hit, close mic, dry",
    hat:   "shaker, single short shake, dry, close mic",
    open:  "acoustic ride cymbal bell, single soft hit, short decay, dry",
  },
};
const DURATION = { kick: 1, snare: 1, hat: 0.5, open: 0.8 };

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.includes("--kit") ? args[args.indexOf("--kit") + 1] : null;

async function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  try {
    const env = await readFile(path.join(ROOT, ".env.local"), "utf8");
    const m = env.match(/^ELEVENLABS_API_KEY\s*=\s*"?([^"\n]+)"?/m);
    if (m) return m[1].trim();
  } catch { /* no .env.local */ }
  throw new Error("Set ELEVENLABS_API_KEY in the environment or in dialed/.env.local");
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function generate(key, text, seconds) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: 0.6 }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

const key = await apiKey();
for (const [kit, sounds] of Object.entries(KITS)) {
  if (only && only !== kit) continue;
  await mkdir(path.join(OUT, kit), { recursive: true });
  for (const [name, prompt] of Object.entries(sounds)) {
    const file = path.join(OUT, kit, `${name}.mp3`);
    if (!force && await exists(file)) { console.log(`skip   ${kit}/${name}.mp3`); continue; }
    process.stdout.write(`gen    ${kit}/${name}.mp3 … `);
    try {
      const mp3 = await generate(key, prompt, DURATION[name]);
      await writeFile(file, mp3);
      console.log(`${(mp3.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      console.log(`FAILED (${e.message})`);
    }
  }
}
console.log("done → public/samples");
