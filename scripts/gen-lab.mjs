#!/usr/bin/env node
/**
 * Generate the Beat Lab sound pack (vocal chops, FX, textures) with the
 * ElevenLabs Sound Effects API. Tonal material stays synthesized in-app so
 * it is always in key; this pack covers the atonal layers.
 *
 *   npm run samples:lab              # skips existing files
 *   npm run samples:lab -- --force   # regenerate everything
 *
 * Output: public/samples/lab/<name>.mp3
 */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "samples", "lab");
const API = "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128";

const SOUNDS = {
  "vox-hey":    ["male rap hype shout hey, single short shout, dry, no music", 1],
  "vox-oh":     ["soulful female vocal chop singing ooh, single short soft note, dry, no music", 1.2],
  "vox-yeah":   ["hype male rap voice saying yeah, single short ad-lib, dry, no music", 1],
  "vox-uh":     ["rapper ad-lib grunt uh, single very short, dry, no music", 0.7],
  "vox-la":     ["smooth female R&B vocal run, la la, very short melisma, dry, no music", 1.4],
  "vox-chant":  ["house music crowd group chant hey, single short shout, energetic, dry", 1],
  "fx-riser":   ["white noise riser sweep rising up, one second, builds tension, no music", 1.2],
  "fx-drop":    ["deep sub bass drop impact with short tail, single cinematic hit, no music", 1.2],
  "fx-vinyl":   ["vinyl record crackle and dust texture, steady, no music, two seconds", 2],
  "fx-sweep":   ["reverse cymbal swell rising, one second, no music", 1.1],
  "fx-scratch": ["DJ vinyl scratch, single short wicka scratch, dry, no music", 0.8],
  "fx-air":     ["airy shimmering atmospheric texture swell, soft, two seconds, no melody", 2],
};

const args = process.argv.slice(2);
const force = args.includes("--force");

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

const key = await apiKey();
await mkdir(OUT, { recursive: true });
for (const [name, [prompt, seconds]] of Object.entries(SOUNDS)) {
  const file = path.join(OUT, `${name}.mp3`);
  if (!force && await exists(file)) { console.log(`skip   lab/${name}.mp3`); continue; }
  process.stdout.write(`gen    lab/${name}.mp3 … `);
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt, duration_seconds: seconds, prompt_influence: 0.55 }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
    const mp3 = Buffer.from(await res.arrayBuffer());
    await writeFile(file, mp3);
    console.log(`${(mp3.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.log(`FAILED (${e.message})`);
  }
}
console.log("done → public/samples/lab");
