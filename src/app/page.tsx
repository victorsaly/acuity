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
            Eight full-screen perception games. Your memory for color, pitch, melody,
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
                <div className="art" aria-hidden style={{ height: 94, background: "repeating-linear-gradient(135deg, #ff4f64 0 14px, #e83c57 14px 28px)" }}>
                  <svg viewBox="0 0 200 94" style={{ width: "100%", height: "100%" }}>
                    <path d="M18 22l12-13 6 17M170 13l12 11-14 8M18 72l14 10 3-16M173 66l12 9-14 7" fill="none" stroke="#f7f04a" strokeWidth="5" strokeLinecap="round" />
                    <rect x="27" y="13" width="146" height="69" fill="#d9d8d2" stroke="#ffffff" strokeWidth="6" />
                    <rect x="38" y="24" width="91" height="44" fill="#25283f" stroke="#0c0d12" strokeWidth="5" />
                    <path d="M42 31h83M42 40h83M42 49h83M42 58h83" stroke="#42e8dc" strokeOpacity=".22" strokeWidth="2" />
                    <ellipse cx="84" cy="54" rx="24" ry="14" fill="#f7f04a" stroke="#0c0d12" strokeWidth="4" />
                    <circle cx="77" cy="51" r="3" fill="#0c0d12" />
                    <circle cx="91" cy="51" r="3" fill="#0c0d12" />
                    <rect x="139" y="23" width="24" height="12" fill="#0c0d12" />
                    <circle cx="151" cy="48" r="8" fill="#42e8dc" stroke="#0c0d12" strokeWidth="4" />
                    <circle cx="151" cy="68" r="8" fill="#f7f04a" stroke="#0c0d12" strokeWidth="4" />
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
                <div className="art" aria-hidden style={{ height: 94, background: "#15172b" }}>
                  <svg viewBox="0 0 200 94" style={{ width: "100%", height: "100%" }}>
                    <path d="M0 47h9l7-17 8 36 9-52 9 66 9-45 8 21 8-9h12" fill="none" stroke="#dfff45" strokeWidth="5" strokeLinejoin="round" />
                    <path d="M122 47h10l7-12 8 34 9-57 8 68 9-43 8 19 8-9h11" fill="none" stroke="#ff456f" strokeWidth="5" strokeLinejoin="round" />
                    <path d="M88 5l-8 34 9 50M112 5l8 35-9 49" fill="#05060a" stroke="#eff0f4" strokeWidth="3" />
                    <circle cx="100" cy="47" r="7" fill="#68e8ff" />
                  </svg>
                </div>
                <h2>Phantom Drop</h2>
                <p>The beat disappears before the drop. Keep time in the silence and bring it back.</p>
                <CardStats game="phantom" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
        </Stagger>
      </Stagger>
      <div className="hint deskHint">Sound on · headphones recommended · F fullscreen · B changes the background</div>
      <div className="hint touchNote">Works on touch — tap to play · sound on, headphones recommended</div>
    </main>
  );
}
