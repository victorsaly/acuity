"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** The event Chromium fires instead of showing its own install prompt. */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED = "beats-install-dismissed";

/**
 * Registers the service worker, and offers the install where a browser lets a
 * page ask for it.
 *
 * The worker is registered from every route rather than just the hub, because
 * an installed app opens at whichever game you left it on.
 *
 * Updates are deliberately not forced through: a new worker waits until every
 * tab is closed rather than taking over mid-run. Swapping the chunks under a
 * game that is halfway through a scored round is not worth being current for.
 */
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const path = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    /* Never in development. `next dev` serves chunks from /_next/static under
       names it reuses, and this worker treats that path as immutable — cache
       first there would hand you yesterday's code and no way to tell. */
    if (process.env.NODE_ENV !== "production") return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    /* After load: the worker warms every route on activation, and that should
       queue behind the page the visitor actually asked for. */
    const register = () => {
      void navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` })
        .catch(() => { /* unsupported, or blocked by the browser's settings */ });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  /* Ask the worker for the drum kits, but only for an installed app.
     They are four megabytes, and the rhythm games are silent without them —
     which is the whole point of an app you can open on a plane. A tab that is
     merely visiting gets the pages and nothing it did not ask for. */
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const installed = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      /* iOS has its own flag and does not report a display mode. */
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ask = () => {
      void navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({ type: "warm-samples" });
      }).catch(() => { /* no worker to ask */ });
    };
    if (installed()) ask();
    window.addEventListener("appinstalled", ask);
    return () => window.removeEventListener("appinstalled", ask);
  }, []);

  useEffect(() => {
    try { if (localStorage.getItem(DISMISSED) === "1") return; } catch { /* ask anyway */ }
    const onPrompt = (event: Event) => {
      /* Keep the event: without preventDefault some browsers show their own
         bar over the game, and the event is the only way to ask later. */
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /* The offer belongs on the hub, where there is room for it. A game gets the
     registration and nothing over its playfield. */
  if (!prompt || path !== "/") return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED, "1"); } catch { /* it will ask again */ }
    setPrompt(null);
  };

  return (
    <div className="installNote" role="complementary" aria-label="Install Delulu Beats">
      <p className="installCopy">
        Install it. Nine games, no network needed, no browser bar in the way.
      </p>
      <span className="installActs">
        <button className="ghost" data-note={523} onClick={() => { void prompt.prompt(); setPrompt(null); }}>
          Install
        </button>
        <button className="linkish" onClick={dismiss}>Not now</button>
      </span>
    </div>
  );
}
