"use client";

import { useCallback, useEffect, useState } from "react";
import GameMark, { type GameKey } from "@/components/GameMark";
import {
  fetchBoard, forgetMe, readToken, rename, signIn, whoAmI,
  type BoardEntry,
} from "@/lib/arcade";
import { todayStamp, dayNumber } from "@/lib/store";

const MARKED: GameKey[] = [
  "color", "sound", "time", "tempo", "memory", "piano", "fever", "phantom", "offgrid",
];

/**
 * The shared board, as seen from inside a game.
 *
 * Scores here are one-decimal but the table holds integers, so everything
 * arrives in tenths and is divided back out for display.
 *
 * A board that cannot be reached is a quiet absence, never an error to deal
 * with: the game is unaffected either way.
 */
export default function Leaderboard({
  mode, title, onClose, metric, unit, blurb, showBack = true, controls,
}: {
  /** `<game>-<difficulty>`, e.g. "color-hard". */
  mode: string;
  title: string;
  onClose: () => void;
  /** The board page has the chrome's own back link; games do not. */
  showBack?: boolean;
  /** Difficulty picker, shown under the title next to the period toggle. */
  controls?: React.ReactNode;
  /** What the number measures, e.g. "Pitch accuracy". */
  metric?: string;
  /** The scale it is out of, e.g. "/ 50". */
  unit?: string;
  /** One line on how the number is arrived at. */
  blurb?: string;
}) {
  /*
   * Everything is stored in tenths because the table holds integers, but not
   * every game reads back as one decimal: levels cleared are whole, and
   * Downbeat is a percentage.
   */
  const show = (tenths: number) => {
    if (unit === "levels") return String(Math.round(tenths / 10));
    if (unit === "%") return `${(tenths / 10).toFixed(1)}%`;
    return (tenths / 10).toFixed(1);
  };
  const [period, setPeriod] = useState<"today" | "alltime">("today");
  const [board, setBoard] = useState<{ entries: BoardEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const today = todayStamp();

  const load = useCallback(async () => {
    setLoading(true);
    setBoard(await fetchBoard(mode, period === "alltime" ? "alltime" : today));
    setLoading(false);
  }, [mode, period, today]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const token = readToken();
    if (!token) return;
    void whoAmI(token).then((who) => who && setMe({ name: who.name }));
  }, []);

  const save = async () => {
    const token = readToken();
    if (!token) return;
    const result = await rename(token, draft);
    if (!result.ok) { setError(result.error); return; }
    setMe({ name: result.name });
    setEditing(false);
    setError("");
    void load();
  };

  const wipe = async () => {
    const token = readToken();
    if (!token) return;
    if (!window.confirm("Delete your name and every score you have posted? This cannot be undone.")) return;
    await forgetMe(token);
    setMe(null);
    void load();
  };

  const rankMark = (rank: number) => (
    <span className={`rankMark${rank <= 3 ? " rankMedal" : ""}`} aria-label={`Rank ${rank}`}>
      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
    </span>
  );

  // "memory-easy" -> "memory": the key carries both the mark and the accent.
  const game = MARKED.find((k) => k === mode.split("-")[0]);

  return (
    <div className="boardWrap" data-game={game}>
      <div className="boardHead">
        <div className="boardIdent">
          {game && <span className="boardMark" aria-hidden><GameMark game={game} /></span>}
          <div>
            <p className="boardEyebrow">
              {period === "today" ? `Daily #${dayNumber()}` : "All time · every daily so far"}
            </p>
            <h2 className="boardTitle">{title}</h2>
            {metric && (
              <p className="boardMetric">{metric}{unit && unit !== "levels" ? ` ${unit}` : ""}</p>
            )}
          </div>
        </div>
        {showBack && <button className="ghost" data-note={349} onClick={onClose}>Back</button>}
      </div>

      <div className="boardControls">
        {controls}
        <div className="modes" role="group" aria-label="Period">
          <button className="mode" aria-pressed={period === "today"} data-note={523}
            onClick={() => setPeriod("today")}>Today</button>
          <button className="mode" aria-pressed={period === "alltime"} data-note={587}
            onClick={() => setPeriod("alltime")}>All time</button>
        </div>
      </div>

      {/* The old rows stay put while the next board loads; swapping them for a
          spinner collapses the list and makes every switch flicker. */}
      {!board && loading ? (
        <p className="boardNote">Loading…</p>
      ) : !board ? (
        <p className="boardNote">The leaderboard is unavailable right now. Your scores are unaffected.</p>
      ) : board.entries.length === 0 ? (
        <p className="boardNote">
          {period === "today"
            ? "Nobody has posted a score on today’s challenge yet. Be first."
            : "No dailies have been finished here yet."}
        </p>
      ) : (
        <ol className={`boardRows${loading ? " isStale" : ""}`}>
          {board.entries.map((e) => (
            <li key={`${e.rank}-${e.name}`}
              className={`boardRow${me && e.name === me.name ? " isMe" : ""}`}>
              <span className="boardRank">{rankMark(e.rank)}</span>
              <span className="boardWho">{e.name}</span>
              <span className="boardMeta">
                {period === "alltime"
                  ? `${e.days} ${e.days === 1 ? "day" : "days"}`
                  : unit === "%" || unit === "levels" ? "" : unit ?? ""}
              </span>
              <span className="boardScore">{show(e.score)}</span>
            </li>
          ))}
        </ol>
      )}

      {blurb && <p className="boardNote boardBlurb">{blurb}</p>}

      <div className="boardFoot">
        {me ? (
          editing ? (
            <div className="boardRename">
              <label className="srOnly" htmlFor="board-name">Display name</label>
              <input id="board-name" className="boardInput" value={draft} maxLength={24}
                autoComplete="off" onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }} />
              <button className="ghost" data-note={523} onClick={() => void save()}>Save</button>
              <button className="ghost" data-note={392} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          ) : (
            <div className="boardMe">
              <span>Posting as <b>{me.name}</b></span>
              <span className="boardActs">
                <button className="linkish" onClick={() => { setDraft(me.name); setEditing(true); }}>Change name</button>
                <button className="linkish" onClick={() => void wipe()}>Delete my data</button>
              </span>
            </div>
          )
        ) : (
          <button className="ghost" data-note={523} onClick={() => signIn()}>
            Sign in with Google to post your score
          </button>
        )}
        {error && <p className="boardNote" role="alert">{error}</p>}
      </div>
    </div>
  );
}
