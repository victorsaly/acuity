"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchBoard, forgetMe, readToken, rename, signIn, whoAmI,
  type BoardEntry,
} from "@/lib/arcade";
import { todayStamp, dayNumber } from "@/lib/store";

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
  mode, title, onClose,
}: {
  /** `<game>-<difficulty>`, e.g. "color-hard". */
  mode: string;
  title: string;
  onClose: () => void;
}) {
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

  const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank));

  return (
    <div className="boardWrap">
      <div className="boardHead">
        <div>
          <p className="boardEyebrow">
            {period === "today" ? `Daily #${dayNumber()}` : "All time · every daily so far"}
          </p>
          <h2 className="boardTitle">{title}</h2>
        </div>
        <button className="ghost" data-note={349} onClick={onClose}>Back</button>
      </div>

      <div className="modes" role="group" aria-label="Period">
        <button className="mode" aria-pressed={period === "today"} data-note={523}
          onClick={() => setPeriod("today")}>Today</button>
        <button className="mode" aria-pressed={period === "alltime"} data-note={587}
          onClick={() => setPeriod("alltime")}>All time</button>
      </div>

      {loading ? (
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
        <ol className="boardRows">
          {board.entries.map((e) => (
            <li key={`${e.rank}-${e.name}`}
              className={`boardRow${me && e.name === me.name ? " isMe" : ""}`}>
              <span className="boardRank">{medal(e.rank)}</span>
              <span className="boardWho">{e.name}</span>
              <span className="boardMeta">
                {period === "alltime" ? `${e.days} ${e.days === 1 ? "day" : "days"}` : ""}
              </span>
              <span className="boardScore">{(e.score / 10).toFixed(1)}</span>
            </li>
          ))}
        </ol>
      )}

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
