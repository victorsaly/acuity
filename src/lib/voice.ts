"use client";

const TTS_URL = process.env.NEXT_PUBLIC_ELEVENLABS_LOCAL_URL;
let enabled = true;

let chain: Promise<void> = Promise.resolve();
let lastText = "";
let lastAt = 0;

function ended(a: HTMLAudioElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      a.removeEventListener("ended", done);
      a.removeEventListener("error", done);
      resolve();
    };
    a.addEventListener("ended", done, { once: true });
    a.addEventListener("error", done, { once: true });
  });
}

async function fetchAudio(text: string): Promise<Blob | null> {
  if (!TTS_URL) return null;
  try {
    const r = await fetch(TTS_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (r.ok) return await r.blob();
  } catch {
    // fall through to GET variant
  }
  try {
    const u = new URL(TTS_URL);
    u.searchParams.set("text", text);
    const r = await fetch(u.toString());
    return r.ok ? await r.blob() : null;
  } catch {
    return null;
  }
}

/**
 * Optional voice cues via local ElevenLabs-compatible endpoint.
 * If NEXT_PUBLIC_ELEVENLABS_LOCAL_URL is missing/offline, this is a no-op.
 */
export function speakCue(text: string) {
  if (!enabled || !TTS_URL || typeof window === "undefined") return;
  const now = performance.now();
  if (text === lastText && now - lastAt < 350) return;
  lastText = text;
  lastAt = now;

  chain = chain.then(async () => {
    const blob = await fetchAudio(text);
    if (!blob || blob.size === 0) return;
    const src = URL.createObjectURL(blob);
    const a = new Audio(src);
    try {
      await a.play();
      await ended(a);
    } catch {
      // autoplay or device policy can block; keep game flow intact
    } finally {
      URL.revokeObjectURL(src);
    }
  }).catch(() => {});
}

export function setVoiceCuesEnabled(on: boolean) {
  enabled = on;
}

export function voiceCuesAvailable() {
  return !!TTS_URL;
}
