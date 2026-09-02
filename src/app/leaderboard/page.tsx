"use client";

import { useState } from "react";
import Link from "next/link";
import Leaderboard from "@/components/Leaderboard";
import GameMark, { type GameKey } from "@/components/GameMark";
import { RANKED } from "@/lib/arcade";

/**
 * The board, from the hub.
 *
 * Every ranked game in one place, so the leaderboard is somewhere you can go
 * rather than something you stumble on inside a game. Only games the server
 * can verify appear here; the list grows as checkers are written.
 */
export default function LeaderboardPage() {
  const [game, setGame] = useState<string>(RANKED[0].key);
  const [level, setLevel] = useState<string>(RANKED[0].levels[0].key);

  const current = RANKED.find((g) => g.key === game) ?? RANKED[0];

  return (
    <main className="stage menuStage">
      <div className="boardPage">
        <div className="boardTiles" role="group" aria-label="Game">
          {RANKED.map((g, i) => (
            <button key={g.key} className="boardTile" data-game={g.key}
              aria-pressed={game === g.key}
              data-note={392 + i * 60}
              onClick={() => { setGame(g.key); setLevel(g.levels[0].key); }}>
              <span className="boardTileMark" aria-hidden><GameMark game={g.key as GameKey} /></span>
              <span className="boardTileName">{g.title}</span>
            </button>
          ))}
        </div>

        <Leaderboard
          mode={`${current.key}-${level}`}
          title={current.title}
          metric={current.metric}
          unit={current.unit}
          blurb={current.blurb}
          showBack={false}
          controls={
            <div className="modes" role="group" aria-label="Difficulty">
              {current.levels.map((l, i) => (
                <button key={l.key} className="mode" aria-pressed={level === l.key}
                  data-note={440 + i * 60} onClick={() => setLevel(l.key)}>
                  {l.label}
                </button>
              ))}
            </div>
          }
          onClose={() => { window.location.href = "/"; }}
        />

        <p className="boardNote boardSoon">
          Only the daily is ranked, and every score is rechecked on the server.
          {" "}<Link href={current.route} className="hubMetaLink">Play {current.title}</Link>
        </p>
      </div>
    </main>
  );
}
