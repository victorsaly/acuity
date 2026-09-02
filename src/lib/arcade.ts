"use client";

/**
 * The shared arcade leaderboard.
 *
 * The same board that ranks Shut The Cube ranks these games — one Google
 * account, one name, across both sites. The API is at api.victorsaly.com and
 * is entirely optional to playing: if it is unreachable, over quota, or
 * blocked, every game plays exactly as it always has and the board simply does
 * not appear. Nothing here throws at its caller.
 *
 * Only the daily challenge is ranked. A free-play run is dealt from a random
 * seed nobody else has, so the server cannot rebuild it to check the score,
 * and an unverifiable entry on a public board is worth less than no entry.
 */

import { useSyncExternalStore } from "react";

const BASE = process.env.NEXT_PUBLIC_ARCADE_API ?? "https://api.victorsaly.com";
const TOKEN_KEY = "beats-session";
const GAME = "beats";

/**
 * The games that can be ranked, and the difficulties each ranks separately.
 *
 * A game appears here only once the Worker can check its scores — ranking a
 * game it cannot verify would put unverifiable entries on a public board. The
 * list grows as checkers are written.
 */
const LEVELS = [
  { key: "easy", label: "Easy" },
  { key: "hard", label: "Hard" },
  { key: "brutal", label: "Brutal" },
] as const;

/**
 * Every ranked game, with what its number actually means.
 *
 * The games do not share a scale — five colours out of ten apiece is not
 * eight taps against a metronome — so the board says what it is measuring
 * rather than showing a bare figure and hoping.
 *
 * Each difficulty keeps its own board: a one-second glance and a five-second
 * one are not the same challenge, even when the targets are.
 */
export const RANKED = [
  { key: "color", title: "Afterimage", route: "/color", levels: LEVELS,
    max: 50, metric: "Colour accuracy", unit: "/ 50",
    blurb: "Five colours, ten points each for how close you got." },
  { key: "sound", title: "Sine Language", route: "/sound", levels: LEVELS,
    max: 50, metric: "Pitch accuracy", unit: "/ 50",
    blurb: "Five tones, ten points each, scored in cents off." },
  { key: "time", title: "Second Sense", route: "/time", levels: LEVELS,
    max: 50, metric: "Duration accuracy", unit: "/ 50",
    blurb: "Five durations, ten points each for how near you held it." },
  { key: "fever", title: "Fever Dream", route: "/fever", levels: LEVELS,
    max: 80, metric: "Timing", unit: "/ 80",
    blurb: "Eight taps, ten points each for landing on the beat." },
  { key: "phantom", title: "Phantom Drop", route: "/phantom", levels: LEVELS,
    max: 30, metric: "Internal timing", unit: "/ 30",
    blurb: "Three drops, ten points each for catching the return." },
  { key: "offgrid", title: "Off-Grid", route: "/offgrid", levels: LEVELS,
    max: 50, metric: "Microtiming", unit: "/ 50",
    blurb: "Five bars: ten for the late hit, three for next door." },
  { key: "memory", title: "Echo", route: "/memory", levels: LEVELS,
    max: 0, metric: "Levels cleared", unit: "levels",
    blurb: "One more tile every level, three lives. How far you got." },
  { key: "piano", title: "Refrain", route: "/piano", levels: LEVELS,
    max: 0, metric: "Levels cleared", unit: "levels",
    blurb: "One more note every level, three lives. How far you got." },
  /* Downbeat is the only game with a fourth difficulty. */
  { key: "tempo", title: "Downbeat", route: "/tempo",
    levels: [...LEVELS.slice(0, 1), { key: "medium", label: "Medium" }, ...LEVELS.slice(1)] as const,
    max: 100, metric: "Accuracy", unit: "%",
    blurb: "Every note scored by how close you landed, less a charge for air." },
] as const;

/** Every game is ranked. Beat Lab has no score by design, so it never will be. */
export const NOT_YET_RANKED = [] as const;

export type BoardEntry = {
  rank: number;
  name: string;
  score: number;
  days?: number;
  shut?: number;
};

/**
 * Whether there is a session, read during render rather than in an effect.
 *
 * Matches how the rest of the app reads local storage: SSR-safe, and it does
 * not set state on mount just to learn something already on disk.
 */
export function useSignedIn(refresh?: unknown): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => {
      void refresh;
      return readToken() !== null;
    },
    () => false,
  );
}

export const readToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const writeToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* a session that cannot be remembered still works for this visit */
  }
};

type CallResult<T> = { ok: boolean; status: number; data: T | null };

/** One request, with a short leash: a board that hangs is worse than absent. */
async function call<T>(
  path: string,
  { method = "GET", body, token, timeout = 6000 }:
    { method?: string; body?: unknown; token?: string | null; timeout?: number } = {},
): Promise<CallResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      /* The board is usually read seconds after posting to it, and a cached
         copy from before the post looks exactly like the post having failed. */
      cache: "no-store",
      signal: controller.signal,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await response.json().catch(() => null)) as T | null;
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Send the browser to Google. It returns to this page with `?auth=`. */
export const signIn = () => {
  const back = `${window.location.origin}${window.location.pathname}`;
  /* An absolute URL to another origin — Next's router cannot and should not
     handle it, so this is a real navigation on purpose. */
  window.location.href = `${BASE}/v1/auth/start?redirect=${encodeURIComponent(back)}`;
};

/**
 * Finish a sign-in just returned from Google.
 *
 * The callback hands over a one-time code rather than the session itself, so
 * no token ever sits in browser history or leaks through a referrer.
 */
export async function claimSession(code: string) {
  const { ok, data } = await call<{ token: string; name: string }>("/v1/auth/claim", {
    method: "POST",
    body: { code },
  });
  if (!ok || !data?.token) return null;
  writeToken(data.token);
  return { name: data.name };
}

export async function whoAmI(token: string) {
  const { ok, status, data } = await call<{ id: string; name: string }>("/v1/me", { token });
  /* Only a real refusal ends a session. Any other failure is the network
     having a moment, and signing someone out for losing signal would break
     the very thing being offline-first is for. */
  if (status === 401) writeToken(null);
  return ok ? data : null;
}

export async function rename(token: string, name: string) {
  const { ok, data } = await call<{ ok: boolean; name: string; error?: string }>("/v1/me", {
    method: "PATCH", token, body: { name },
  });
  return ok && data
    ? { ok: true as const, name: data.name }
    : { ok: false as const, error: data?.error ?? "Could not save that name." };
}

/** Erase the account and every score behind it. Immediate, and final. */
export async function forgetMe(token: string) {
  const { ok } = await call<{ ok: boolean }>("/v1/me", { method: "DELETE", token });
  if (ok) writeToken(null);
  return ok;
}

export async function fetchBoard(mode: string, period: string, limit = 20) {
  const query = new URLSearchParams({ game: GAME, mode, period, limit: String(limit) });
  const { ok, data } = await call<{ board: string; entries: BoardEntry[] }>(`/v1/board?${query}`);
  return ok ? data : null;
}

export type BeatsSubmission = {
  /** `<game>-<difficulty>`, e.g. "color-hard". */
  mode: string;
  period: string;
  seed: number;
  /** Tenths — 42.1 points travels as 421, because the table holds integers. */
  score: number;
  /** Whatever the game's checker needs to recompute the score. */
  proof: unknown;
};

export async function submitScore(token: string, run: BeatsSubmission) {
  const { ok, data, status } = await call<{ ok: boolean; rank: number | null }>("/v1/score", {
    method: "POST",
    token,
    body: { game: GAME, ...run },
  });
  if (status === 401) writeToken(null);
  return ok ? data : null;
}
