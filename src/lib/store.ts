"use client";

import { useCallback, useSyncExternalStore } from "react";

/* Best scores, remembered preferences, and run randomness. */

/**
 * A localStorage-backed preference that survives refreshes. SSR-safe.
 *
 * Pass `allowed` whenever the value indexes into a config object: a stored key
 * from an older build (difficulty names change as games get reworked) would
 * otherwise come back and crash the lookup. Anything unrecognised falls back
 * to `def`.
 */
export function usePref(key: string, def: string, allowed?: readonly string[]): [string, (v: string) => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("acuity-pref", cb);
    return () => window.removeEventListener("acuity-pref", cb);
  }, []);
  const get = useCallback(() => {
    try {
      const v = localStorage.getItem(`dialed-pref-${key}`) ?? def;
      return !allowed || allowed.includes(v) ? v : def;
    } catch { return def; }
  }, [key, def, allowed]);
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

export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

/** A fresh deterministic stream for each run. */
export function runRng(): () => number {
  return seededRng((Math.random() * 4294967296) >>> 0);
}

/** A stream for one known seed, so a run can be shared or ranked. */
export function seededRng(seed: number): () => number {
  return mulberry32(seed);
}

/** Any string to a well-mixed 32-bit seed (xfnv1a). */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The seed for one game's daily challenge.
 *
 * Namespaced per game so the same date deals each game its own challenge, and
 * deliberately not per difficulty: difficulty changes how long you get to look,
 * never what you are looking at, so one board can rank every level together.
 */
export function dailySeed(game: string, stamp: string = todayStamp()): number {
  return seedFrom(`beats:${stamp}:${game}`);
}

/** The first daily. Day numbers on a shared card count from here. */
export const DAILY_EPOCH = "2026-09-02";

/** Which daily this is, counting the epoch as #1 — the number on the card. */
export function dayNumber(stamp: string = todayStamp()): number {
  const [y, m, d] = stamp.split("-").map(Number);
  const [ey, em, ed] = DAILY_EPOCH.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000) + 1;
}

/* ---------- play stats: games played + daily streak, per game ---------- */

export type Stats = { plays: number; days: string[] };

export function getStats(game: string): Stats {
  try {
    const raw = localStorage.getItem(`dialed-stats-${game}`);
    if (raw) return JSON.parse(raw) as Stats;
  } catch { /* fall through */ }
  return { plays: 0, days: [] };
}

/** Call once per finished run. Keeps the last 60 distinct play dates. */
export function recordPlay(game: string) {
  const s = getStats(game);
  const today = todayStamp();
  s.plays += 1;
  if (!s.days.includes(today)) s.days = [...s.days, today].slice(-60);
  try { localStorage.setItem(`dialed-stats-${game}`, JSON.stringify(s)); } catch { /* no persistence */ }
  window.dispatchEvent(new Event("acuity-pref"));
}

/** Consecutive days played, ending today or yesterday. */
export function streakOf(s: Stats): number {
  const set = new Set(s.days);
  const d = new Date();
  const stamp = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  if (!set.has(stamp(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(stamp(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** Reactive stats for the hub (re-reads when a run is recorded). */
export function useStats(game: string): Stats {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("acuity-pref", cb);
    return () => window.removeEventListener("acuity-pref", cb);
  }, []);
  const get = useCallback(() => {
    try { return localStorage.getItem(`dialed-stats-${game}`) ?? ""; } catch { return ""; }
  }, [game]);
  const raw = useSyncExternalStore(subscribe, get, () => "");
  try { return raw ? (JSON.parse(raw) as Stats) : { plays: 0, days: [] }; } catch { return { plays: 0, days: [] }; }
}

export function scoreKey(game: string, diff: string): string {
  return `${game}-${diff}`;
}
