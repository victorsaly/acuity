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
import { todayStamp } from "@/lib/store";

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
 * Fires whenever the stored session changes, so a sign-in reaches the screen.
 *
 * `localStorage` is not reactive and the tab that writes it gets no `storage`
 * event, so without this a sign-in only shows up on the next render that
 * happened to have another reason to run. The app already signals its own
 * storage writes this way (see `usePref` in store.ts).
 */
const SESSION_EVENT = "beats-session-change";

function subscribeSession(cb: () => void) {
  window.addEventListener(SESSION_EVENT, cb);
  /* Signing in or out in another tab counts too — that one does get `storage`. */
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SESSION_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Whether there is a session, read during render rather than in an effect.
 *
 * Matches how the rest of the app reads local storage: SSR-safe, and it does
 * not set state on mount just to learn something already on disk.
 */
export function useSignedIn(refresh?: unknown): boolean {
  return useSyncExternalStore(
    subscribeSession,
    () => {
      void refresh;
      return readToken() !== null;
    },
    () => false,
  );
}

/**
 * The session token itself, for state that belongs to one account.
 *
 * `useSignedIn` answers whether there is a session, which is not enough to
 * notice that it is now a *different* one — a name fetched for the last
 * account would otherwise sit there until the next `whoAmI` answered.
 */
export function useSessionToken(): string | null {
  return useSyncExternalStore(subscribeSession, readToken, () => null);
}

/**
 * Where the session lives when storage will not keep it.
 *
 * Safari in private mode, and any browser set to block site data, throw on
 * write. The comment here used to say such a session still worked for the
 * visit; it did not. `readToken` asked local storage and nothing else, so
 * signing in on those browsers succeeded and then appeared to do nothing at
 * all — the same symptom this whole change set out to fix.
 */
let memoryToken: string | null = null;

export const readToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
};

export const writeToken = (token: string | null) => {
  /* Set first, and unconditionally: this is the copy that makes the claim in
     the comment above true. */
  memoryToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Not remembered past this page load — but this visit is signed in. */
  } finally {
    window.dispatchEvent(new Event(SESSION_EVENT));
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

const PENDING_KEY = "beats-pending-run";

/**
 * Post a finished daily — now if there is a session, or once there is one.
 *
 * The offer on a result screen ("put this score on the daily board") sends the
 * browser to Google and back to a fresh mount, so by the time a token exists
 * the run that earned the score is long gone. Holding the run here is what
 * makes that offer one the app can actually honour; before this, taking it up
 * signed you in and quietly lost the score.
 *
 * `sessionStorage`, not `localStorage`: an unposted run is worth carrying
 * across one redirect, not across next week's visit.
 */
export async function postRun(run: BeatsSubmission) {
  const token = readToken();
  if (token) return submitScore(token, run);
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(run));
  } catch {
    /* no storage — the run just is not carried across the redirect */
  }
  return null;
}

/** What a held-back run turned into, once there was a session to post it under. */
export type PostedRun = { mode: string; rank: number | null };

async function flushPendingRun(token: string): Promise<PostedRun | null> {
  let run: BeatsSubmission | null = null;
  try {
    const held = sessionStorage.getItem(PENDING_KEY);
    /* Read and drop together: single-use, so a failed post is not retried
       against a board it was already refused by. */
    sessionStorage.removeItem(PENDING_KEY);
    run = held ? (JSON.parse(held) as BeatsSubmission) : null;
  } catch {
    return null;
  }
  /* Only today's. The daily rolls over at midnight and a sign-in can take
     longer than that; the server would refuse yesterday's period anyway. */
  if (!run?.mode || run.period !== todayStamp()) return null;
  const posted = await submitScore(token, run);
  return posted ? { mode: run.mode, rank: posted.rank } : null;
}

/**
 * The query the callback appends when it sends the browser back here.
 *
 * `auth` is the name the Worker uses. `code` is accepted as well because that
 * is the only other shape a redirect back from an OAuth callback takes, and
 * spending a code that turns out not to be ours costs one rejected request.
 */
const AUTH_PARAMS = ["auth", "code"] as const;

/**
 * Spend the one-time code, if this page load is a return trip from Google.
 *
 * Without this the round trip never completes: the browser comes back holding
 * a code nobody claims, no token is ever written, and every board and result
 * screen goes on offering to sign you in — which is exactly what it looked
 * like from the outside.
 *
 * The code leaves the address bar either way. It is single-use, so leaving it
 * there only means a refresh tries to spend it again and fails, and a one-time
 * credential does not belong in history or in a referrer header.
 */
export async function completeSignIn(): Promise<{ name: string; posted: PostedRun | null } | null> {
  const url = new URL(window.location.href);
  const key = AUTH_PARAMS.find((param) => url.searchParams.get(param));
  if (!key) return null;
  const code = url.searchParams.get(key) as string;

  /* Strip before awaiting, not after: React runs mount effects twice in
     development, and the second pass must not find the code still sitting
     there and race the first to spend it. */
  for (const param of AUTH_PARAMS) url.searchParams.delete(param);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

  const session = await claimSession(code);
  if (!session) return null;
  const token = readToken();
  return { name: session.name, posted: token ? await flushPendingRun(token) : null };
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
