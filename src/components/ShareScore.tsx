"use client";

import { useEffect, useRef, useState } from "react";
import { shareScore, type Score } from "@/lib/share";

/**
 * One button on every results screen. The device's own share sheet already
 * lists WhatsApp and everything else, so there is nothing per-app here.
 */
export default function ShareScore(score: Score) {
  const [state, setState] = useState<"idle" | "shared" | "copied">("idle");
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flash = (next: "shared" | "copied") => {
    setState(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1800);
  };

  return (
    <button
      type="button"
      className="ghost shareAction"
      data-note={523}
      aria-live="polite"
      onClick={async () => {
        const outcome = await shareScore(score);
        if (outcome !== "cancelled") flash(outcome);
      }}
    >
      <svg className="shareIcon" viewBox="0 0 24 24" aria-hidden>
        {state === "idle" ? (
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4" />
          </g>
        ) : (
          <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      {state === "shared" ? "Shared" : state === "copied" ? "Copied" : "Share your score"}
    </button>
  );
}
