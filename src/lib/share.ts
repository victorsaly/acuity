"use client";

/* Wordle-style shareable score cards. The blocks are the whole trick:
   a row of colour reads as a score at a glance in a chat, where
   "B A B A" reads as nothing. Keep them. */

export const SITE_URL = "https://delulubeats.com";

export const slotEmoji = (score10: number) =>
  score10 >= 9 ? "🟩" : score10 >= 7 ? "🟨" : score10 >= 4 ? "🟧" : "🟥";

export const barEmoji = (pct: number) => {
  const filled = Math.round(Math.max(0, Math.min(100, pct)) / 10);
  return "🟩".repeat(filled) + "⬛".repeat(10 - filled);
};

/** One finished run, in the shape every game's results screen can describe. */
export type Score = {
  /** Display name, e.g. "Afterimage". */
  game: string;
  /** Route slug, e.g. "color" — also picks the social image the link previews. */
  route: string;
  /** How it was played, e.g. "hard · flash". */
  detail: string;
  /** The result itself, e.g. "42.1 / 50 | Grades: A B C A B". */
  line: string;
  /** Difficulty, replayed by GameSetup so the challenge starts on the same one. */
  level?: string;
};

/** The same run, on the same settings — what the recipient is being dared into. */
export function challengeUrl({ route, level }: Score): string {
  return level
    ? `${SITE_URL}/${route}/?level=${encodeURIComponent(level)}`
    : `${SITE_URL}/${route}/`;
}

export function scoreCard({ game, detail, line }: Score): string {
  return `DELULU BEATS · ${game.toUpperCase()} · ${detail.toUpperCase()}\n\n${line}\n\nThink you can beat it?`;
}

export type ShareOutcome = "shared" | "copied" | "cancelled";

/**
 * Hand the score to whatever the device shares with — WhatsApp, Messages,
 * anything else in the sheet. The challenge link goes in `url` rather than
 * buried in the text so the target renders the game's own preview card.
 * Desktop browsers without a share sheet fall back to the clipboard.
 */
export async function shareScore(score: Score): Promise<ShareOutcome> {
  const text = scoreCard(score);
  const url = challengeUrl(score);
  if (navigator.share) {
    try {
      await navigator.share({ title: `${score.game} · Delulu Beats`, text, url });
      return "shared";
    } catch {
      return "cancelled"; // user dismissed the sheet — don't silently copy instead
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch { /* clipboard unavailable */ }
  return "cancelled";
}
