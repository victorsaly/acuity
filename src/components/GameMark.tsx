/*
 * The nine game marks, in one place. The hub tiles and the game menus both
 * draw from here, and scripts/social-art.mjs mirrors it for the social images
 * — so the icon you see on the hub, the one on the game's own menu and the
 * one in a shared link preview are all the same drawing.
 *
 * Every mark is built in a 200x72 box. The part that carries the game's
 * identity is `currentColor`, so whatever sets `color` decides the accent;
 * the supporting lines stay bone white.
 */

export type GameKey =
  | "color" | "sound" | "time" | "tempo" | "memory"
  | "piano" | "fever" | "phantom" | "offgrid";

const MARKS: Record<GameKey, React.ReactNode> = {
  color: (
    <>
      {["#ff5959", "#ffb13d", "#ffe93d", "#6fe06f", "#3dc9ff", "#7a6bff", "#e05fd0"].map((c, i) => (
        <rect key={c} x={4 + i * 28} y={14} width={24} height={44} rx={6} fill={c} />
      ))}
      <rect x={4} y={14} width={192} height={44} rx={6} fill="none" stroke="rgba(239,240,244,.2)" />
    </>
  ),
  sound: (
    <path
      d="M0 36 Q 12 4 25 36 T 50 36 T 75 36 T 100 36 T 125 36 T 150 36 T 175 36 T 200 36"
      fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
    />
  ),
  time: (
    <>
      <circle cx="100" cy="36" r="29" fill="none" stroke="rgba(239,240,244,.18)" strokeWidth="1" />
      <circle cx="100" cy="36" r="20" fill="none" stroke="rgba(239,240,244,.3)" strokeWidth="1" />
      <path d="M100 7 A29 29 0 0 1 127 47" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="127" cy="47" r="4" fill="currentColor" />
      <circle cx="100" cy="36" r="3" fill="#ffffff" opacity=".65" />
    </>
  ),
  tempo: (
    <>
      <line x1="0" y1="36" x2="200" y2="36" stroke="rgba(239,240,244,.2)" strokeWidth="2" />
      <circle cx="40" cy="36" r="13" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="96" cy="36" r="8" fill="#ffffff" />
      <circle cx="138" cy="36" r="8" fill="#ffffff" opacity=".55" />
      <circle cx="176" cy="36" r="8" fill="#ffffff" opacity=".3" />
    </>
  ),
  memory: (
    <>
      {[0, 1, 2].map((r) => [0, 1, 2, 3, 4, 5, 6].map((c) => {
        const on = [[0, 1], [1, 2], [1, 4], [2, 3], [0, 5], [2, 6]].some(([rr, cc]) => rr === r && cc === c);
        return (
          <rect key={`${r}-${c}`} x={10 + c * 26} y={4 + r * 22} width={20} height={18} rx={4}
            fill={on ? "currentColor" : "rgba(239,240,244,.12)"} />
        );
      }))}
    </>
  ),
  piano: (
    <>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={`w${i}`} x={i * 25 + 1} y={2} width={23} height={68} rx={3}
          fill={i === 4 ? "currentColor" : "#eff0f4"} />
      ))}
      {[0, 1, 3, 4, 5].map((i) => (
        <rect key={`b${i}`} x={i * 25 + 17} y={2} width={16} height={40} rx={2.5} fill="#0c0d12" />
      ))}
    </>
  ),
  fever: (
    <>
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M23 26c-4 6-4 14 0 20" opacity=".45" />
        <path d="M13 20c-6 9-6 23 0 32" opacity=".2" />
        <path d="M177 26c4 6 4 14 0 20" opacity=".45" />
        <path d="M187 20c6 9 6 23 0 32" opacity=".2" />
      </g>
      <g className="feverShake">
        <path d="M52 60v6M148 60v6" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity=".55" />
        <rect x="36" y="10" width="128" height="50" rx="7" fill="none" stroke="#ffffff" strokeWidth="3" />
        <rect x="44" y="18" width="74" height="34" rx="4" fill="rgba(239,240,244,.07)" stroke="rgba(239,240,244,.45)" strokeWidth="2" />
        <path d="M50 25h62M50 47h62" stroke="rgba(239,240,244,.14)" strokeWidth="2" strokeLinecap="round" />
        <path d="M72 24q9-7 18 0" fill="none" stroke="rgba(239,240,244,.4)" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="81" cy="40" rx="12" ry="10" fill="#ffffff" />
        <circle cx="76.5" cy="38" r="2.2" fill="#0c0d12" />
        <circle cx="85.5" cy="38" r="2.2" fill="#0c0d12" />
        <path d="M77.5 44q3.5 3 7 0" fill="none" stroke="#0c0d12" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="126" y="18" width="30" height="10" rx="2" fill="currentColor" opacity=".85" />
        <circle cx="134" cy="42" r="5.5" fill="none" stroke="#ffffff" strokeWidth="2.5" />
        <circle cx="148" cy="42" r="5.5" fill="#ffffff" opacity=".45" />
      </g>
    </>
  ),
  phantom: (
    <>
      {[40, 46, 32, 38, 24, 28, 15, 11].map((h, i) => (
        <rect key={`l${i}`} x={6 + i * 9} y={36 - h / 2} width={4} height={h} rx={2}
          fill="#ffffff" opacity={0.95 - i * 0.085} />
      ))}
      <path d="M79 22v28M117 22v28" stroke="rgba(239,240,244,.22)" strokeWidth="2" strokeLinecap="round" />
      <path d="M83 36h31" stroke="rgba(239,240,244,.35)" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
      <g className="phantomDrop">
        <path d="M122 7v58" stroke="currentColor" strokeWidth="2" opacity=".8" />
        <circle cx="122" cy="36" r="5" fill="currentColor" />
      </g>
      {[50, 36, 44, 28, 34, 22, 26].map((h, i) => (
        <rect key={`r${i}`} x={132 + i * 9} y={36 - h / 2} width={4} height={h} rx={2}
          fill="#ffffff" opacity={0.95 - i * 0.05} />
      ))}
    </>
  ),
  offgrid: (
    <>
      <path d="M0 58h200" stroke="rgba(239,240,244,.22)" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <path key={`t${i}`} d={`M${16 + i * 24} 52v12`} stroke="rgba(239,240,244,.3)" strokeWidth="2" />
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const off = i === 4 ? 9 : 0;
        return (
          <rect key={`s${i}`} x={10 + i * 24 + off} y={i === 4 ? 8 : 14} width={12} height={i === 4 ? 44 : 38} rx={3}
            fill={i === 4 ? "currentColor" : "rgba(239,240,244,.55)"} />
        );
      })}
      <path d="M112 4h13m0 0-4-3.5M125 4l-4 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export default function GameMark({ game, className }: { game: GameKey; className?: string }) {
  return (
    <svg viewBox="0 0 200 72" className={className} aria-hidden>
      {MARKS[game]}
    </svg>
  );
}
