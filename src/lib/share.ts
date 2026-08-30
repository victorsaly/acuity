"use client";

/* Wordle-style shareable score cards. */

export const SITE_URL = "https://victorsaly.github.io/acuity/";

export const slotEmoji = (score10: number) =>
  score10 >= 9 ? "🟩" : score10 >= 7 ? "🟨" : score10 >= 4 ? "🟧" : "🟥";

export const barEmoji = (pct: number) => {
  const filled = Math.round(Math.max(0, Math.min(100, pct)) / 10);
  return "🟩".repeat(filled) + "⬛".repeat(10 - filled);
};

export function scoreCard(game: string, detail: string, scoreLine: string): string {
  return `ACUITY · ${game} · ${detail}\n${scoreLine}\n${SITE_URL}`;
}

/** Copy to clipboard; fall back to the native share sheet. */
export async function shareText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* clipboard unavailable */ }
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return true;
    }
  } catch { /* user dismissed */ }
  return false;
}
