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

/** Open the native share sheet (mobile, includes WhatsApp); fall back to clipboard. */
export async function shareText(text: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return true;
    } catch {
      return false; // user cancelled the sheet - don't silently copy instead
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* clipboard unavailable */ }
  return false;
}

/** wa.me deep link so the same score card opens straight into WhatsApp on any device. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
