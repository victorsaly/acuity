"use client";

import Link from "next/link";
import { Stagger, Item, Tilt } from "@/components/Fx";
import { useStats, streakOf } from "@/lib/store";

const cardWrap: React.CSSProperties = { display: "flex", flex: "1 1 240px", maxWidth: 280 };

function CardStats({ game }: { game: string }) {
  const s = useStats(game);
  const streak = streakOf(s);
  if (!s.plays) return <span className="cardStats">Not played yet</span>;
  return (
    <span className="cardStats">
      Played {s.plays}{streak > 1 ? ` · ${streak}-day streak` : ""}
    </span>
  );
}

export default function Hub() {
  return (
    <main className="stage menuStage">
      <Stagger style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <Item>
          <div className="brandLockup">
            <svg className="brandMark" viewBox="0 0 64 64" aria-hidden>
              <circle cx="32" cy="32" r="17" fill="none" stroke="#f0f0f4" strokeWidth="4" />
              <circle className="brandBeat" cx="32" cy="32" r="7" fill="none" stroke="#f0f0f4" strokeWidth="1.5" />
              <circle className="brandCore" cx="32" cy="32" r="5" fill="#f0f0f4" />
              <g className="brandSatellite">
                <circle cx="32" cy="9" r="2.5" fill="#f0f0f4" />
              </g>
            </svg>
            <h1 className="wordmark brandName">
              <span>Delulu</span>{" "}<span>Beats</span>
            </h1>
          </div>
        </Item>
        <Item>
          <p className="tagline">
            Nine full-screen perception games. Your memory for color, pitch, melody,
            time, and space is worse than you think — prove otherwise.
          </p>
        </Item>
        <Stagger className="hubCards" delay={0.12}>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/color" className="hubCard" data-note={523} style={{ width: "100%" }}>
                <div
                  className="art"
                  style={{
                    background:
                      "conic-gradient(from 0deg, #ff5959, #ffb13d, #ffe93d, #6fe06f, #3dc9ff, #7a6bff, #e05fd0, #ff5959)",
                    filter: "blur(1px) saturate(1.1)",
                  }}
                />
                <h2>Afterimage</h2>
                <p>Five colors flood the screen, then you rebuild each one from memory.</p>
                <CardStats game="color" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/sound" className="hubCard" data-note={659} style={{ width: "100%" }}>
                <div className="art" aria-hidden>
                  <svg viewBox="0 0 200 72" style={{ width: "100%", height: "100%" }}>
                    <path
                      d="M0 36 Q 12 4 25 36 T 50 36 T 75 36 T 100 36 T 125 36 T 150 36 T 175 36 T 200 36"
                      fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round"
                    />
                  </svg>
                </div>
                <h2>Sine Language</h2>
                <p>Five tones play once each, then you pull every pitch back out of thin air.</p>
                <CardStats game="sound" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/time" className="hubCard" data-note={698} style={{ width: "100%" }}>
                <div className="art" aria-hidden>
                  <svg viewBox="0 0 200 72" style={{ width: "100%", height: "100%" }}>
                    <circle cx="100" cy="36" r="29" fill="none" stroke="rgba(239,240,244,.18)" strokeWidth="1" />
                    <circle cx="100" cy="36" r="20" fill="none" stroke="rgba(239,240,244,.3)" strokeWidth="1" />
                    <path d="M100 7 A29 29 0 0 1 127 47" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="127" cy="47" r="4" fill="#ffffff" />
                    <circle cx="100" cy="36" r="3" fill="#ffffff" opacity=".65" />
                  </svg>
                </div>
                <h2>Second Sense</h2>
                <p>Feel each duration, then hold and release to recreate it without a clock.</p>
                <CardStats game="time" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/tempo" className="hubCard" data-note={784} style={{ width: "100%" }}>
                <div className="art" aria-hidden>
                  <svg viewBox="0 0 200 72" style={{ width: "100%", height: "100%" }}>
                    <line x1="0" y1="36" x2="200" y2="36" stroke="rgba(239,240,244,.2)" strokeWidth="2" />
                    <circle cx="40" cy="36" r="13" fill="none" stroke="#ffffff" strokeWidth="3" />
                    <circle cx="96" cy="36" r="8" fill="#ffffff" />
                    <circle cx="138" cy="36" r="8" fill="#ffffff" opacity=".55" />
                    <circle cx="176" cy="36" r="8" fill="#ffffff" opacity=".3" />
                  </svg>
                </div>
                <h2>Downbeat</h2>
                <p>A beat rolls, notes swing in from the deep — tap dead on time or eat the miss.</p>
                <CardStats game="tempo" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/memory" className="hubCard" data-note={880} style={{ width: "100%" }}>
                <div className="art" aria-hidden>
                  <svg viewBox="0 0 200 72" style={{ width: "100%", height: "100%" }}>
                    {[0, 1, 2].map((r) => [0, 1, 2, 3, 4, 5, 6].map((c) => {
                      const on = [[0, 1], [1, 2], [1, 4], [2, 3], [0, 5], [2, 6]].some(([rr, cc]) => rr === r && cc === c);
                      return (
                        <rect key={`${r}-${c}`} x={10 + c * 26} y={4 + r * 22} width={20} height={18} rx={4}
                          fill={on ? "#ffffff" : "rgba(239,240,244,.12)"} />
                      );
                    }))}
                  </svg>
                </div>
                <h2>Echo</h2>
                <p>Numbered tiles flash and vanish. Tap them back in order before the clock runs out.</p>
                <CardStats game="memory" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/piano" className="hubCard" data-note={988} style={{ width: "100%" }}>
                <div className="art" aria-hidden>
                  <svg viewBox="0 0 200 72" style={{ width: "100%", height: "100%" }}>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <rect key={`w${i}`} x={i * 25 + 1} y={2} width={23} height={68} rx={3}
                        fill={i === 4 ? "#b9b9c2" : "#eff0f4"} />
                    ))}
                    {[0, 1, 3, 4, 5].map((i) => (
                      <rect key={`b${i}`} x={i * 25 + 17} y={2} width={16} height={40} rx={2.5} fill="#0c0d12" />
                    ))}
                  </svg>
                </div>
                <h2>Refrain</h2>
                <p>A piano phrase grows one note per level — play the same notes back in order.</p>
                <CardStats game="piano" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/fever" className="hubCard" data-note={1047} style={{ width: "100%" }}>
                <div className="art" aria-hidden>
                  <svg viewBox="0 0 200 72" style={{ width: "100%", height: "100%" }}>
                    <g stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none">
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
                      <rect x="126" y="18" width="30" height="10" rx="2" fill="#ffffff" opacity=".85" />
                      <circle cx="134" cy="42" r="5.5" fill="none" stroke="#ffffff" strokeWidth="2.5" />
                      <circle cx="148" cy="42" r="5.5" fill="#ffffff" opacity=".45" />
                    </g>
                  </svg>
                </div>
                <h2>Fever Dream</h2>
                <p>The microwave keeps the beat. Read its movement, then feed it eight taps.</p>
                <CardStats game="fever" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/phantom" className="hubCard" data-note={1175} style={{ width: "100%" }}>
                <div className="art" aria-hidden>
                  <svg viewBox="0 0 200 72" style={{ width: "100%", height: "100%" }}>
                    {[40, 46, 32, 38, 24, 28, 15, 11].map((h, i) => (
                      <rect key={`l${i}`} x={6 + i * 9} y={36 - h / 2} width={4} height={h} rx={2}
                        fill="#ffffff" opacity={0.95 - i * 0.085} />
                    ))}
                    <path d="M79 22v28M117 22v28" stroke="rgba(239,240,244,.22)" strokeWidth="2" strokeLinecap="round" />
                    <path d="M83 36h31" stroke="rgba(239,240,244,.35)" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
                    <g className="phantomDrop">
                      <path d="M122 7v58" stroke="#ffffff" strokeWidth="2" opacity=".8" />
                      <circle cx="122" cy="36" r="5" fill="#ffffff" />
                    </g>
                    {[50, 36, 44, 28, 34, 22, 26].map((h, i) => (
                      <rect key={`r${i}`} x={132 + i * 9} y={36 - h / 2} width={4} height={h} rx={2}
                        fill="#ffffff" opacity={0.95 - i * 0.05} />
                    ))}
                  </svg>
                </div>
                <h2>Phantom Drop</h2>
                <p>The beat disappears before the drop. Keep time in the silence and bring it back.</p>
                <CardStats game="phantom" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/offgrid" className="hubCard" data-note={1319} style={{ width: "100%" }}>
                <div className="art" aria-hidden>
                  <svg viewBox="0 0 200 72" style={{ width: "100%", height: "100%" }}>
                    <path d="M0 58h200" stroke="rgba(239,240,244,.22)" strokeWidth="2" />
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <path key={`t${i}`} d={`M${16 + i * 24} 52v12`} stroke="rgba(239,240,244,.3)" strokeWidth="2" />
                    ))}
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                      const off = i === 4 ? 9 : 0;
                      return (
                        <rect key={`s${i}`} x={10 + i * 24 + off} y={i === 4 ? 8 : 14} width={12} height={i === 4 ? 44 : 38} rx={3}
                          fill={i === 4 ? "#ffffff" : "rgba(239,240,244,.55)"} />
                      );
                    })}
                    <path d="M112 4h13m0 0-4-3.5M125 4l-4 3.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2>Off-Grid</h2>
                <p>A loop repeats and one hit lands late. Find it before the nudge shrinks past hearing.</p>
                <CardStats game="offgrid" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
        <Item style={{ width: "100%", maxWidth: 900, display: "flex" }}>
          <Tilt style={{ display: "flex", width: "100%" }}>
            <Link href="/studio" className="hubCard studioCard" data-note={1397} style={{ width: "100%" }}>
              <div className="art studioArt" aria-hidden>
                <svg viewBox="0 0 200 72" style={{ width: "100%", height: "100%" }}>
                  {[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5, 6, 7].map((c) => {
                    const on = [[0, 0], [0, 4], [1, 2], [1, 6], [2, 0], [2, 2], [2, 4], [2, 6], [3, 3], [3, 5]]
                      .some(([rr, cc]) => rr === r && cc === c);
                    return (
                      <rect key={`${r}-${c}`} x={6 + c * 17} y={5 + r * 16} width={13} height={12} rx={3}
                        fill={on ? "#ffffff" : "rgba(239,240,244,.14)"} />
                    );
                  }))}
                  <path d="M152 12v48M170 22v38M188 6v54" stroke="rgba(239,240,244,.35)" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="152" cy="30" r="6" fill="#ffffff" />
                  <circle cx="170" cy="48" r="6" fill="#ffffff" />
                  <circle cx="188" cy="18" r="6" fill="#ffffff" />
                </svg>
              </div>
              <div className="studioCopy">
                <h2>Beat Lab</h2>
                <p>Not a game — a studio. Pick and mix drums, bass, chords, melody and vocal chops in rap, R&amp;B or house; everything stays in key. Play it, then download your track.</p>
                <span className="go">Create ▸</span>
              </div>
            </Link>
          </Tilt>
        </Item>
        </Stagger>
      </Stagger>
      <div className="hint deskHint">
        <Link href="/about" className="hubMetaLink">About &amp; credits</Link>
        {" · "}Sound on · headphones recommended · F fullscreen · B changes the background
      </div>
      <div className="hint touchNote">
        <Link href="/about" className="hubMetaLink">About &amp; credits</Link>
        {" · "}Works on touch — tap to play · sound on, headphones recommended
      </div>
    </main>
  );
}
