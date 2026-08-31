"use client";

import Link from "next/link";
import { Stagger, Item, Tilt } from "@/components/Fx";
import GameMark from "@/components/GameMark";
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
            Nine games about noticing things. You will be worse at them than you
            expect. That&apos;s most of the fun.
          </p>
        </Item>
        <Stagger className="hubCards" delay={0.12}>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/color" className="hubCard" data-game="color" data-note={523} style={{ width: "100%" }}>
                <div className="art" aria-hidden />
                <h2>Afterimage</h2>
                <p>Five colors, one at a time, then nothing. Rebuild each one on a slider.</p>
                <CardStats game="color" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/sound" className="hubCard" data-game="sound" data-note={659} style={{ width: "100%" }}>
                <div className="art" aria-hidden><GameMark game="sound" /></div>
                <h2>Sine Language</h2>
                <p>Five tones. Each plays once. Now go find them again by ear.</p>
                <CardStats game="sound" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/time" className="hubCard" data-game="time" data-note={698} style={{ width: "100%" }}>
                <div className="art" aria-hidden><GameMark game="time" /></div>
                <h2>Second Sense</h2>
                <p>How long was that? Hold the button for exactly as long. No clock anywhere.</p>
                <CardStats game="time" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/tempo" className="hubCard" data-game="tempo" data-note={784} style={{ width: "100%" }}>
                <div className="art" aria-hidden><GameMark game="tempo" /></div>
                <h2>Downbeat</h2>
                <p>Asteroids tumble in on the beat. Tap them at the ring or watch them sail past.</p>
                <CardStats game="tempo" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/memory" className="hubCard" data-game="memory" data-note={880} style={{ width: "100%" }}>
                <div className="art" aria-hidden><GameMark game="memory" /></div>
                <h2>Echo</h2>
                <p>Numbered tiles flash, then go dark. Tap them back in order, and hurry.</p>
                <CardStats game="memory" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/piano" className="hubCard" data-game="piano" data-note={988} style={{ width: "100%" }}>
                <div className="art" aria-hidden><GameMark game="piano" /></div>
                <h2>Refrain</h2>
                <p>A phrase plays. You play it back. One note longer every level.</p>
                <CardStats game="piano" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/fever" className="hubCard" data-game="fever" data-note={1047} style={{ width: "100%" }}>
                <div className="art" aria-hidden><GameMark game="fever" /></div>
                <h2>Fever Dream</h2>
                <p>A microwave is keeping time. Watch how it moves, then give it eight taps back.</p>
                <CardStats game="fever" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/phantom" className="hubCard" data-game="phantom" data-note={1175} style={{ width: "100%" }}>
                <div className="art" aria-hidden><GameMark game="phantom" /></div>
                <h2>Phantom Drop</h2>
                <p>The beat cuts out right before the drop. Count the silence. Land the 1.</p>
                <CardStats game="phantom" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
          <Item style={cardWrap}>
            <Tilt style={{ display: "flex", width: "100%" }}>
              <Link href="/offgrid" className="hubCard" data-game="offgrid" data-note={1319} style={{ width: "100%" }}>
                <div className="art" aria-hidden><GameMark game="offgrid" /></div>
                <h2>Off-Grid</h2>
                <p>One hit in the loop is late. Point at it. Every round it gets harder to hear.</p>
                <CardStats game="offgrid" />
                <span className="go">Play ▸</span>
              </Link>
            </Tilt>
          </Item>
        <Item style={{ width: "100%", maxWidth: 900, display: "flex" }}>
          <Tilt style={{ display: "flex", width: "100%" }}>
            <Link href="/studio" className="hubCard studioCard" data-game="studio" data-note={1397} style={{ width: "100%" }}>
              <div className="art studioArt" aria-hidden>
                <svg viewBox="0 0 200 72" style={{ width: "100%", height: "100%" }}>
                  {([
                    [[0, 4], "#ffb02e"],
                    [[2, 6], "#c48bff"],
                    [[0, 2, 4, 6], "#4be1ff"],
                    [[3, 7], "#eff0f4"],
                  ] as [number[], string][]).map(([on, col], r) =>
                    [0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
                      <rect key={`${r}-${c}`} x={5 + c * 17} y={5 + r * 16.5} width={13} height={13} rx={3.5}
                        fill={on.includes(c) ? col : "rgba(239,240,244,.1)"} />
                    )))}
                  <g stroke="rgba(239,240,244,.3)" strokeWidth="3" strokeLinecap="round">
                    <path d="M156 8v56M175 8v56M194 8v56" />
                  </g>
                  <rect className="fk1" x="149" y="22" width="14" height="9" rx="3" fill="#ffb02e" />
                  <rect className="fk2" x="168" y="42" width="14" height="9" rx="3" fill="#c48bff" />
                  <rect className="fk3" x="187" y="14" width="14" height="9" rx="3" fill="#4be1ff" />
                </svg>
              </div>
              <div className="studioCopy">
                <span className="studioTag">The Studio</span>
                <h2>Beat Lab</h2>
                <p>No score, no timer. Stack drums, bass, chords, melody and vocal chops in rap, R&amp;B or house. It stays in key even when you don&apos;t. Download whatever you end up with.</p>
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
      <div className="footJoke">
        No accounts, no leaderboard, nobody watching you lose. The microwave is the only
        one keeping score, and it has never explained how.
      </div>
      <div className="hint touchNote">
        <Link href="/about" className="hubMetaLink">About &amp; credits</Link>
        {" · "}Works on touch — tap to play · sound on, headphones recommended
      </div>
    </main>
  );
}
