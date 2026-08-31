"use client";

import { useSyncExternalStore } from "react";

/*
 * The accent for the route you are playing — the colour its hub tile, its
 * menu mark and its shared-link preview all use. globals.css is the one place
 * it is written down (on .gameRoot[data-game]); everything else, canvas
 * included, reads it back from there rather than keeping its own copy.
 */

export type Hsl = { h: number; s: number; l: number };

/** Bone white — what a game draws as before the accent has been read. */
const BONE: Hsl = { h: 228, s: 13, l: 95 };

function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (!d) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0))
    : max === g ? (b - r) / d + 2
    : (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

/** Read the accent off the DOM. Safe to call inside a draw loop. */
export function readAccent(): Hsl {
  if (typeof document === "undefined") return BONE;
  const root = document.querySelector("[data-game]");
  if (!root) return BONE;
  return hexToHsl(getComputedStyle(root).getPropertyValue("--accent")) ?? BONE;
}

/* A route's accent never changes once it is on screen, but useSyncExternalStore
   needs the same object back every time or it re-renders forever — so keep one
   per game rather than parsing the colour again on each read. */
const perGame = new Map<string, Hsl>();
const noopSubscribe = () => () => {};

function snapshot(): Hsl {
  const key = document.querySelector("[data-game]")?.getAttribute("data-game") ?? "";
  let accent = perGame.get(key);
  if (!accent) { accent = readAccent(); perGame.set(key, accent); }
  return accent;
}

/** The accent for render-time colours. Bone on the server, the real one on the client. */
export function useAccent(): Hsl {
  return useSyncExternalStore(noopSubscribe, snapshot, () => BONE);
}

/** `hsl(...)` at a lightness the caller controls — pitch, depth, whatever it maps. */
export const shade = (a: Hsl, l: number, alpha = 1) =>
  `hsla(${a.h.toFixed(0)} ${a.s.toFixed(0)}% ${l.toFixed(0)}% / ${alpha})`;
