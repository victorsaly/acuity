/*
 * PWA icons and store screenshots.
 *
 * The site had one SVG icon, which browsers accept for a tab and Android does
 * not accept for a home screen: an installable app needs raster icons at fixed
 * sizes, one of them maskable so the launcher can cut it to whatever shape the
 * device uses, and iOS needs an opaque apple-touch-icon of its own.
 *
 * Everything here is drawn from the same mark as src/app/icon.svg — three
 * cells, the last one amber and sitting slightly low, because that is the
 * whole joke. Change one and change the other.
 *
 * Runs on prebuild alongside gen-social. Output is committed, so a build
 * without network still ships icons; the Google Fonts fetch is best effort.
 */
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { GAMES } from "./social-art.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const INK = "#0c0d12";
const BONE = "#eff0f4";
const MUTED = "#7e8290";
const AMBER = "#ffb02e";

const OLD_UA = "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 Chrome/40 Safari/537.36";

async function googleFont(family, weight) {
  const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`;
  const css = await fetch(url, { headers: { "User-Agent": OLD_UA } }).then((r) => r.text());
  const latin = css.split("@font-face").find((block) => block.includes("U+0000-00FF"));
  const src = latin?.match(/src:\s*url\((https:[^)]+)\)/);
  if (!src) throw new Error(`no latin face for ${family} ${weight}`);
  return Buffer.from(await fetch(src[1]).then((r) => r.arrayBuffer()));
}

async function loadFonts() {
  try {
    const [display, mono] = await Promise.all([
      googleFont("Unbounded", 900),
      googleFont("Spline+Sans+Mono", 400),
    ]);
    return [
      { name: "Unbounded", data: display, weight: 900, style: "normal" },
      { name: "Spline Sans Mono", data: mono, weight: 400, style: "normal" },
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

/**
 * The mark on its ground.
 *
 * `scale` is how much of the canvas the three cells may use. A maskable icon
 * gets a small one: launchers crop to a circle inscribed in the middle 80%,
 * and anything outside that safe zone is liable to be shaved off.
 */
function mark({ size, scale, radius }) {
  const cell = size * 0.219 * scale;
  const gap = size * 0.0625 * scale;
  const box = { width: cell, height: cell, borderRadius: cell * 0.29, display: "flex" };
  return h("div", {
    style: {
      width: size, height: size, display: "flex",
      alignItems: "center", justifyContent: "center",
      background: INK, borderRadius: radius,
    },
  },
    h("div", { style: { display: "flex", alignItems: "flex-start" } },
      h("div", { style: { ...box, background: BONE } }),
      h("div", { style: { ...box, marginLeft: gap, background: BONE, opacity: 0.35 } }),
      h("div", { style: { ...box, marginLeft: gap * 1.25, marginTop: cell * 0.43, background: AMBER } }),
    ),
  );
}

/** A store screenshot: the wordmark over a strip of the games' own card art. */
function shot({ wide }, fonts) {
  const display = fonts ? "Unbounded" : undefined;
  const mono = fonts ? "Spline Sans Mono" : undefined;
  const tiles = wide ? GAMES.slice(0, 6) : GAMES.slice(0, 4);
  const tileWidth = wide ? 320 : 300;
  return h("div", {
    style: {
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: wide ? 40 : 48,
      padding: wide ? "56px 64px" : "64px 40px",
      background: `radial-gradient(900px 620px at 50% 0%, #ffb02e1f, ${INK} 66%)`,
      color: BONE, fontFamily: mono,
    },
  },
    h("div", {
      style: {
        fontFamily: display, fontWeight: 900, fontSize: wide ? 88 : 68,
        letterSpacing: -1, textTransform: "uppercase", display: "flex",
        textAlign: "center", justifyContent: "center",
      },
    }, "Delulu Beats"),
    h("div", {
      style: {
        fontSize: wide ? 28 : 24, lineHeight: 1.5, color: MUTED,
        textAlign: "center", maxWidth: wide ? 820 : 560, display: "flex",
      },
    }, "Nine tiny games about hearing, timing, and being confidently wrong."),
    h("div", {
      style: {
        display: "flex", flexWrap: "wrap", gap: 18,
        alignItems: "center", justifyContent: "center", maxWidth: wide ? 1060 : 620,
      },
    },
      ...tiles.map((game) => h("div", {
        key: game.route,
        style: {
          display: "flex", alignItems: "center", justifyContent: "center",
          width: tileWidth, height: tileWidth * 0.46, borderRadius: 22,
          background: "rgba(21,23,33,0.72)", border: `1px solid ${game.accent}59`,
        },
      }, h("img", { src: artUrl(game.art), width: tileWidth * 0.78, height: tileWidth * 0.28 }))),
    ),
  );
}

async function render(element, file, size, fonts) {
  const png = await new ImageResponse(element, { ...size, fonts }).arrayBuffer();
  await writeFile(path.join(ROOT, file), Buffer.from(png));
  console.log(`  public/${file}`);
}

const fonts = await loadFonts();
await mkdir(path.join(ROOT, "icons"), { recursive: true });

for (const size of [192, 512]) {
  /* `any` keeps the rounded corners transparent, the way a desktop launcher
     expects. `maskable` is full-bleed square with the mark pulled well inside
     the safe zone, because the launcher supplies the shape. */
  await render(mark({ size, scale: 1, radius: size * 0.219 }), `icons/icon-${size}.png`, { width: size, height: size }, fonts);
  await render(mark({ size, scale: 0.62, radius: 0 }), `icons/maskable-${size}.png`, { width: size, height: size }, fonts);
}
/* iOS masks this one itself and renders any transparency as black, so it is
   square and opaque with the mark inset to survive the rounding. */
await render(mark({ size: 180, scale: 0.78, radius: 0 }), "icons/apple-touch-icon.png", { width: 180, height: 180 }, fonts);

await render(shot({ wide: true }, fonts), "icons/screenshot-wide.png", { width: 1240, height: 720 }, fonts);
await render(shot({ wide: false }, fonts), "icons/screenshot-narrow.png", { width: 720, height: 1280 }, fonts);
