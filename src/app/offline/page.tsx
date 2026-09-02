import type { Metadata } from "next";
import Link from "next/link";

/**
 * What a navigation gets when the network is gone and that page was never
 * cached. Installed to a home screen the app warms every route, so this is
 * mostly for a browser tab that met the site once and lost signal since.
 */
export const metadata: Metadata = {
  title: "Offline",
  description: "Delulu Beats is offline. The games you have already opened still work.",
  robots: { index: false, follow: false },
};

export default function Offline() {
  return (
    <main className="stage menuStage">
      <div className="boardWrap">
        <h1 className="boardTitle">No signal</h1>
        <p className="boardNote">
          This page has not been here before, and there is no network to fetch it
          with. Anything you have already opened still plays — the games run
          entirely in your browser, and your scores are kept on this device.
        </p>
        <p className="boardNote">
          The leaderboard needs a connection. It will be waiting.
        </p>
        <div className="boardFoot">
          <Link href="/" className="ghost" data-note={349}>Back to the games</Link>
        </div>
      </div>
    </main>
  );
}
