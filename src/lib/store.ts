"use client";

import { useCallback, useSyncExternalStore } from "react";

/* Best scores, remembered preferences, seeded randomness for daily mode. */

/** A localStorage-backed preference that survives refreshes. SSR-safe. */
export function usePref(key: string, def: string): [string, (v: string) => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("acuity-pref", cb);
    return () => window.removeEventListener("acuity-pref", cb);
  }, []);
  const get = useCallback(() => {
    try { return localStorage.getItem(`dialed-pref-${key}`) ?? def; } catch { return def; }
  }, [key, def]);
  const value = useSyncExternalStore(subscribe, get, () => def);
  const set = useCallback((v: string) => {
    try { localStorage.setItem(`dialed-pref-${key}`, v); } catch { /* no persistence */ }
    window.dispatchEvent(new Event("acuity-pref"));
  }, [key]);
  return [value, set];
}

export function getBest(key: string): number {
  try {
    return parseFloat(localStorage.getItem(`dialed-best-${key}`) ?? "") || 0;
  } catch {
    return 0;
  }
}

export function setBest(key: string, v: number) {
  try {
    localStorage.setItem(`dialed-best-${key}`, String(v));
  } catch {
    /* storage unavailable — scores just don't persist */
  }
}

export type Mode = "free" | "daily";

export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Daily mode: same sequence for everyone on the same date; free mode: fresh every run. */
export function rngFor(mode: Mode, game: string, diff: string): () => number {
  if (mode === "daily") return mulberry32(hash(`${todayStamp()}/${game}/${diff}`));
  return mulberry32((Math.random() * 4294967296) >>> 0);
}

export function scoreKey(game: string, mode: Mode, diff: string): string {
  return mode === "daily" ? `${game}-daily-${diff}-${todayStamp()}` : `${game}-${diff}`;
}
