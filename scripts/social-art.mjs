/*
 * The nine game cards, as flat SVG. This mirrors the art on the hub
 * (src/app/page.tsx) minus the animation classes — if you change a card
 * there, change it here so the shared image still looks like the game.
 * Each art is drawn in a 200x72 viewBox.
 */

const rainbow = [
  "#ff5959", "#ffb13d", "#ffe93d", "#6fe06f", "#3dc9ff", "#7a6bff", "#e05fd0",
];

export const GAMES = [
  {
    route: "color",
    title: "Afterimage",
    tagline: "Five colors, one at a time, then nothing. Rebuild each one on a slider.",
    accent: "#ff5959",
    art: `
      ${rainbow.map((c, i) => `<rect x="${4 + i * 28}" y="14" width="24" height="44" rx="6" fill="${c}"/>`).join("")}
      <rect x="4" y="14" width="192" height="44" rx="6" fill="none" stroke="rgba(239,240,244,.2)" stroke-width="1"/>`,
  },
  {
    route: "sound",
    title: "Sine Language",
    tagline: "Five tones, played once each. Then you go find the same pitches by ear.",
    accent: "#4be1ff",
    art: `
      <path d="M0 36 Q 12 4 25 36 T 50 36 T 75 36 T 100 36 T 125 36 T 150 36 T 175 36 T 200 36"
        fill="none" stroke="#4be1ff" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    route: "time",
    title: "Second Sense",
    tagline: "Five stretches of time. Hold the button for exactly as long, with no clock to help.",
    accent: "#ffe93d",
    art: `
      <circle cx="100" cy="36" r="29" fill="none" stroke="rgba(239,240,244,.18)" stroke-width="1"/>
      <circle cx="100" cy="36" r="20" fill="none" stroke="rgba(239,240,244,.3)" stroke-width="1"/>
      <path d="M100 7 A29 29 0 0 1 127 47" fill="none" stroke="#ffe93d" stroke-width="3" stroke-linecap="round"/>
      <circle cx="127" cy="47" r="4" fill="#ffe93d"/>
      <circle cx="100" cy="36" r="3" fill="#eff0f4" opacity=".65"/>`,
  },
  {
    route: "tempo",
    title: "Downbeat",
    tagline: "Asteroids tumble in on the beat. Tap them at the ring, dead on time.",
    accent: "#c48bff",
    art: `
      <line x1="0" y1="36" x2="200" y2="36" stroke="rgba(239,240,244,.2)" stroke-width="2"/>
      <circle cx="40" cy="36" r="13" fill="none" stroke="#c48bff" stroke-width="3"/>
      <circle cx="96" cy="36" r="8" fill="#eff0f4"/>
      <circle cx="138" cy="36" r="8" fill="#eff0f4" opacity=".55"/>
      <circle cx="176" cy="36" r="8" fill="#eff0f4" opacity=".3"/>`,
  },
  {
    route: "memory",
    title: "Echo",
    tagline: "Numbered tiles light up and go dark. Tap them back in order before the clock runs out.",
    accent: "#6fe06f",
    art: [0, 1, 2].map((r) => [0, 1, 2, 3, 4, 5, 6].map((c) => {
      const on = [[0, 1], [1, 2], [1, 4], [2, 3], [0, 5], [2, 6]].some(([rr, cc]) => rr === r && cc === c);
      return `<rect x="${10 + c * 26}" y="${4 + r * 22}" width="20" height="18" rx="4" fill="${on ? "#6fe06f" : "rgba(239,240,244,.12)"}"/>`;
    }).join("")).join(""),
  },
  {
    route: "piano",
    title: "Refrain",
    tagline: "A piano phrase plays and you play it back. One note longer every level.",
    accent: "#8b5cf6",
    art: `
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
        `<rect x="${i * 25 + 1}" y="2" width="23" height="68" rx="3" fill="${i === 4 ? "#8b5cf6" : "#eff0f4"}"/>`).join("")}
      ${[0, 1, 3, 4, 5].map((i) =>
        `<rect x="${i * 25 + 17}" y="2" width="16" height="40" rx="2.5" fill="#0c0d12"/>`).join("")}`,
  },
  {
    route: "fever",
    title: "Fever Dream",
    tagline: "A microwave is keeping the beat. Read how it moves, then keep the pulse alone.",
    accent: "#ffb13d",
    art: `
      <g stroke="#ffb13d" stroke-width="2.5" stroke-linecap="round" fill="none">
        <path d="M23 26c-4 6-4 14 0 20" opacity=".55"/>
        <path d="M13 20c-6 9-6 23 0 32" opacity=".25"/>
        <path d="M177 26c4 6 4 14 0 20" opacity=".55"/>
        <path d="M187 20c6 9 6 23 0 32" opacity=".25"/>
      </g>
      <path d="M52 60v6M148 60v6" stroke="#eff0f4" stroke-width="3" stroke-linecap="round" opacity=".55"/>
      <rect x="36" y="10" width="128" height="50" rx="7" fill="none" stroke="#eff0f4" stroke-width="3"/>
      <rect x="44" y="18" width="74" height="34" rx="4" fill="rgba(255,177,61,.1)" stroke="rgba(239,240,244,.45)" stroke-width="2"/>
      <path d="M50 25h62M50 47h62" stroke="rgba(239,240,244,.14)" stroke-width="2" stroke-linecap="round"/>
      <path d="M72 24q9-7 18 0" fill="none" stroke="rgba(239,240,244,.4)" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="81" cy="40" rx="12" ry="10" fill="#eff0f4"/>
      <circle cx="76.5" cy="38" r="2.2" fill="#0c0d12"/>
      <circle cx="85.5" cy="38" r="2.2" fill="#0c0d12"/>
      <path d="M77.5 44q3.5 3 7 0" fill="none" stroke="#0c0d12" stroke-width="1.8" stroke-linecap="round"/>
      <rect x="126" y="18" width="30" height="10" rx="2" fill="#ffb13d" opacity=".9"/>
      <circle cx="134" cy="42" r="5.5" fill="none" stroke="#eff0f4" stroke-width="2.5"/>
      <circle cx="148" cy="42" r="5.5" fill="#eff0f4" opacity=".45"/>`,
  },
  {
    route: "phantom",
    title: "Phantom Drop",
    tagline: "The beat cuts out before the drop. Keep counting through the silence and land the 1.",
    accent: "#7a6bff",
    art: `
      ${[40, 46, 32, 38, 24, 28, 15, 11].map((h, i) =>
        `<rect x="${6 + i * 9}" y="${36 - h / 2}" width="4" height="${h}" rx="2" fill="#eff0f4" opacity="${(0.95 - i * 0.085).toFixed(3)}"/>`).join("")}
      <path d="M79 22v28M117 22v28" stroke="rgba(239,240,244,.22)" stroke-width="2" stroke-linecap="round"/>
      <path d="M83 36h31" stroke="rgba(239,240,244,.35)" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>
      <path d="M122 7v58" stroke="#7a6bff" stroke-width="2" opacity=".9"/>
      <circle cx="122" cy="36" r="5" fill="#7a6bff"/>
      ${[50, 36, 44, 28, 34, 22, 26].map((h, i) =>
        `<rect x="${132 + i * 9}" y="${36 - h / 2}" width="4" height="${h}" rx="2" fill="#eff0f4" opacity="${(0.95 - i * 0.05).toFixed(3)}"/>`).join("")}`,
  },
  {
    route: "offgrid",
    title: "Off-Grid",
    tagline: "One hit in an eight-step drum loop lands late. Say which one, before it gets too small to hear.",
    accent: "#e05fd0",
    art: `
      <path d="M0 58h200" stroke="rgba(239,240,244,.22)" stroke-width="2"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
        `<path d="M${16 + i * 24} 52v12" stroke="rgba(239,240,244,.3)" stroke-width="2"/>`).join("")}
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const off = i === 4 ? 9 : 0;
        return `<rect x="${10 + i * 24 + off}" y="${i === 4 ? 8 : 14}" width="12" height="${i === 4 ? 44 : 38}" rx="3" fill="${i === 4 ? "#e05fd0" : "rgba(239,240,244,.55)"}"/>`;
      }).join("")}
      <path d="M112 4h13m0 0-4-3.5M125 4l-4 3.5" stroke="#e05fd0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
];
