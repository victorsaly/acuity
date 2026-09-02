"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RANKED, completeSignIn, type PostedRun } from "@/lib/arcade";

/**
 * Spends the one-time code Google's callback leaves in the URL, and says what
 * came of it.
 *
 * Sign-in is offered from the board and from every game's result screen, so
 * the browser can come back to any route — which is why this sits in the root
 * layout rather than on the leaderboard page.
 *
 * It comes back to a fresh mount with the result screen gone, so a run posted
 * on the way in has nowhere left to report to. Hence the note: without it,
 * taking up the offer on that button looks exactly like nothing happening.
 */
export default function ArcadeSession() {
  const [done, setDone] = useState<{ name: string; posted: PostedRun | null } | null>(null);

  useEffect(() => {
    void completeSignIn().then((result) => result && setDone(result));
  }, []);

  /* Long enough to read twice, and it never covers anything: the games put
     their controls in the middle of the screen, not the bottom corner. */
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(null), 9000);
    return () => clearTimeout(timer);
  }, [done]);

  if (!done) return null;

  const game = done.posted && RANKED.find((g) => g.key === done.posted?.mode.split("-")[0]);

  return (
    <div className="signedInNote" role="status">
      <p className="signedInName">Signed in as <b>{done.name}</b></p>
      {game && done.posted?.rank !== null && done.posted !== null ? (
        <p className="signedInScore">
          Your run is <b>#{done.posted.rank}</b> on today&rsquo;s {game.title} board.{" "}
          <Link href="/leaderboard" className="hubMetaLink">See the board</Link>
        </p>
      ) : (
        <p className="signedInScore">Your daily scores are ranked from now on.</p>
      )}
      <button className="signedInClose" data-note={349} onClick={() => setDone(null)}
        aria-label="Dismiss">×</button>
    </div>
  );
}
