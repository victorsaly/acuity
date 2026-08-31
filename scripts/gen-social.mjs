/*
 * Per-game social images. Renders one 1200x630 PNG per game into
 * public/social/, so a shared score links to a preview showing that game's
 * own card art instead of one generic site image.
 *
 * Runs on prebuild. Output is committed, so a build without network still
 * ships images — the Google Fonts fetch below is best effort and falls back
 * to the bundled font if it fails.
 */
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { GAMES } from "./social-art.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "social");
const SIZE = { width: 1200, height: 630 };
const INK = "#0c0d12";
const BONE = "#eff0f4";
const MUTED = "#7e8290";

/* Google's CSS only serves ttf to a user agent old enough not to know woff2,
   and satori cannot read woff2. */
const OLD_UA = "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 Chrome/40 Safari/537.36";

async function googleFont(family, weight) {
  const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`;
  const css = await fetch(url, { headers: { "User-Agent": OLD_UA } }).then((r) => r.text());
  /* One @font-face per subset; the latin one is the only subset these images
     use, and it is the only one small enough to be worth embedding. */
  const latin = css.split("@font-face").find((block) => block.includes("U+0000-00FF"));
  const src = latin?.match(/src:\s*url\((https:[^)]+)\)/);
  if (!src) throw new Error(`no latin face for ${family} ${weight}`);
  return Buffer.from(await fetch(src[1]).then((r) => r.arrayBuffer()));
}

async function loadFonts() {
  try {
    const [display, mono, monoBold] = await Promise.all([
      googleFont("Unbounded", 900),
      googleFont("Spline+Sans+Mono", 400),
      googleFont("Spline+Sans+Mono", 600),
    ]);
    return [
      { name: "Unbounded", data: display, weight: 900, style: "normal" },
      { name: "Spline Sans Mono", data: mono, weight: 400, style: "normal" },
      { name: "Spline Sans Mono", data: monoBold, weight: 600, style: "normal" },
    ];
  } catch (err) {
    console.warn(`  fonts: falling back to the bundled face (${err.message})`);
    return undefined;
  }
}

const artUrl = (body) =>
  "data:image/svg+xml;base64," + Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 72" width="200" height="72">${body}</svg>`,
  ).toString("base64");

/** 1200x630: eyebrow and title on the left, the game's own card art on the right. */
function card({ title, tagline, accent, art }, fonts) {
  const display = fonts ? "Unbounded" : undefined;
  const mono = fonts ? "Spline Sans Mono" : undefined;
  return h("div", {
    style: {
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "space-between", padding: "64px 72px",
      background: `radial-gradient(900px 620px at 88% 12%, ${accent}26, ${INK} 68%)`,
      color: BONE, fontFamily: mono,
    },
  },
    h("div", { style: { display: "flex", alignItems: "center", gap: 16 } },
      h("div", { style: { width: 14, height: 14, borderRadius: 14, background: accent, display: "flex" } }),
      h("div", { style: { fontSize: 22, letterSpacing: 5, color: MUTED, textTransform: "uppercase" } }, "Delulu Beats"),
    ),
    h("div", { style: { display: "flex", alignItems: "center", gap: 56 } },
      h("div", { style: { display: "flex", flexDirection: "column", width: 560 } },
        h("div", {
          style: {
            fontFamily: display, fontWeight: 900, fontSize: title.length > 11 ? 62 : 74,
            lineHeight: 1.05, letterSpacing: -1, textTransform: "uppercase",
          },
        }, title),
        h("div", { style: { marginTop: 22, fontSize: 26, lineHeight: 1.45, color: MUTED } }, tagline),
      ),
      h("div", {
        style: {
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 440, height: 280, borderRadius: 28,
          background: "rgba(21,23,33,0.72)", border: `1px solid ${accent}59`,
        },
      },
        h("img", { src: artUrl(art), width: 376, height: 135 }),
      ),
    ),
    h("div", { style: { display: "flex", fontSize: 22, letterSpacing: 3, color: MUTED } }, "delulubeats.com"),
  );
}

async function render(element, file, fonts) {
  const png = await new ImageResponse(element, { ...SIZE, fonts }).arrayBuffer();
  await writeFile(path.join(OUT, file), Buffer.from(png));
  console.log(`  public/social/${file}`);
}

const fonts = await loadFonts();
await mkdir(OUT, { recursive: true });

/* opengraph.png and twitter.png — the site-wide pair the hub and /about
   still use — are hand-drawn and deliberately not regenerated here. */
for (const game of GAMES) await render(card(game, fonts), `${game.route}.png`, fonts);
