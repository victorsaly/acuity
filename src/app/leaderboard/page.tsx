"use client";

import { useState } from "react";
import Link from "next/link";
import Leaderboard from "@/components/Leaderboard";
import { RANKED, NOT_YET_RANKED } from "@/lib/arcade";

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
        <div className="modes boardGames" role="group" aria-label="Game">
          {RANKED.map((g, i) => (
            <button key={g.key} className="mode" aria-pressed={game === g.key}
              data-note={392 + i * 60}
              onClick={() => { setGame(g.key); setLevel(g.levels[0].key); }}>
              {g.title}
            </button>
          ))}
        </div>

        <div className="modes" role="group" aria-label="Difficulty">
          {current.levels.map((l, i) => (
            <button key={l.key} className="mode" aria-pressed={level === l.key}
              data-note={440 + i * 60} onClick={() => setLevel(l.key)}>
              {l.label}
            </button>
          ))}
        </div>

        <Leaderboard
          mode={`${current.key}-${level}`}
          title={current.title}
          metric={current.metric}
          unit={current.unit}
          blurb={current.blurb}
          onClose={() => { window.location.href = "/"; }}
        />

        <p className="boardNote">
          Only the daily is ranked. <Link href={current.route} className="hubMetaLink">Play {current.title}</Link>
        </p>

        {/* The rest of the games exist and are not here yet. Saying so is
            better than an absence nobody can explain. */}
        <p className="boardNote boardSoon">
          Not ranked yet:{" "}
          {NOT_YET_RANKED.map((g, i) => (
            <span key={g.route}>
              {i > 0 && ", "}
              <Link href={g.route} className="hubMetaLink">{g.title}</Link>
            </span>
          ))}
          . Each needs its score checked server-side before it can join, so that
          nothing on the board is taken on trust.
        </p>
      </div>
    </main>
  );
}
