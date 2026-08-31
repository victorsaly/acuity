"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { audioState, uiBlip, unlockAudio } from "@/lib/audio";

const CONSENT_KEY = "dialed-sound-ok";

/**
 * A blocked `resume()` returns a promise that stays pending until the browser
 * sees a user gesture, so waiting on it can hang forever. Race it against a
 * short timeout and read the state instead.
 */
async function tryUnlock(): Promise<boolean> {
  const attempt = unlockAudio().catch(() => {});
  await Promise.race([attempt, new Promise((resolve) => setTimeout(resolve, 150))]);
  return audioState() === "running";
}

const subscribe = (cb: () => void) => {
  window.addEventListener("acuity-pref", cb);
  return () => window.removeEventListener("acuity-pref", cb);
};

/**
 * Full-screen landing gate. Every game here is played by ear, so the app is
 * not usable until the AudioContext is actually running — a corner button was
 * too easy to walk past, and people started games in silence.
 *
 * Browsers require a fresh user gesture per page load and that cannot be
 * persisted, but the *consent* can: a returning visitor is remembered, so the
 * gate greets them instead of explaining itself, and any tap or key anywhere
 * on the page satisfies it rather than one specific button. Where the browser
 * grants sound on its own (Chrome raises a site's media engagement score after
 * repeat visits) the context is already running on mount and the gate never
 * renders at all.
 */
export default function SoundGate() {
  const [open, setOpen] = useState(true);
  /* Read through the store's event so the server renders the first-visit copy
     and hydration corrects it — a lazy useState initialiser would touch
     localStorage during the prerender and mismatch. */
  const returning = useSyncExternalStore(
    subscribe,
    () => {
      try { return localStorage.getItem(CONSENT_KEY) === "1"; } catch { return false; }
    },
    () => false,
  );

  const pass = useCallback((withBlip: boolean) => {
    try { localStorage.setItem(CONSENT_KEY, "1"); } catch { /* no persistence */ }
    window.dispatchEvent(new Event("acuity-pref"));
    setOpen(false);
    if (withBlip) uiBlip(660, 0.06, 0.14);
  }, []);

  /* Mount: a browser that already allows sound lets us skip the gate outright. */
  useEffect(() => {
    void tryUnlock().then((ok) => { if (ok) pass(false); });
  }, [pass]);

  /* Any real gesture counts, not just the button — the gate covers the page,
     so the tap that would have started a game unlocks and dismisses it. */
  useEffect(() => {
    if (!open) return;
    const onGesture = () => { void tryUnlock().then((ok) => { if (ok) pass(false); }); };
    window.addEventListener("pointerdown", onGesture, { capture: true });
    window.addEventListener("keydown", onGesture, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture, { capture: true });
      window.removeEventListener("keydown", onGesture, { capture: true });
    };
  }, [open, pass]);

  /* iOS suspends the context whenever the tab is backgrounded. Try to resume
     silently first; only fall back to the gate if the browser refuses. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible" || audioState() === "running") return;
      void tryUnlock().then((ok) => { if (!ok) setOpen(true); });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!open) return null;

  return (
    <div className="soundGate" role="dialog" aria-modal="true" aria-labelledby="soundGateTitle">
      <div className="soundGateInner">
        <div className="soundGateMark" aria-hidden>
          <span /><span /><span /><span /><span />
        </div>
        <h1 id="soundGateTitle" className="soundGateTitle">
          {returning ? "Welcome back" : "Sound on"}
        </h1>
        <p className="soundGateCopy">
          {returning
            ? "Your browser needs one tap per visit before it will make a sound. Tap anywhere to pick up where you left off."
            : "Every game here is played by ear — there is nothing to see without it. Turn the volume up, headphones if you have them, then tap to let the browser through."}
        </p>
        <button
          className="cta soundGateBtn"
          data-silent
          onClick={() => { void tryUnlock().then(pass); }}
        >
          {returning ? "Resume sound" : "Enable sound"}
        </button>
        <p className="soundGateHint">Tap anywhere · or press any key</p>
      </div>
    </div>
  );
}
