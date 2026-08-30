"use client";

import Link from "next/link";
import { Stagger, Item, Tilt } from "@/components/Fx";

const cardWrap: React.CSSProperties = { display: "flex", flex: "1 1 240px", maxWidth: 280 };

export default function Hub() {
  return (
    <main className="stage">
      <Stagger style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <Item><h1 className="wordmark">Acuity</h1></Item>
        <Item>
          <p className="tagline">
            Three full-screen perception games. Your memory for color, pitch, and time
            is worse than you think — prove otherwise.
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
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
        </Stagger>
      </Stagger>
      <div className="hint">Sound on · headphones recommended · F fullscreen · B changes the background</div>
    </main>
  );
}
