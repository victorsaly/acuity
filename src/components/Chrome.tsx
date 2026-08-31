"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { audioState, uiBlip, unlockAudio } from "@/lib/audio";

/**
 * App-wide chrome: fullscreen toggle, home link, and the rollover
 * sound layer — every button and link answers a hover with a soft
 * blip (its data-note pitch, or a default), and clicks confirm a
 * fifth higher. Audio unlocks on the first press anywhere.
 */
export default function Chrome() {
  const path = usePathname();
  const router = useRouter();
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(hover: none) or (pointer: coarse)");
    const update = () => setIsTouchDevice(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  /* Esc is hierarchical: a game mid-run handles it (and calls
     preventDefault) to drop back to its menu; if nothing claimed it,
     Esc means "previous page" — back to the hub. */
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || path === "/") return;
      setTimeout(() => {
        if (!e.defaultPrevented && !document.fullscreenElement) router.push("/");
      }, 0);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [path, router]);

  useEffect(() => {
    /* Once the context is running there is nothing left to unlock — re-priming
       on every subsequent click just builds throwaway audio nodes. */
    const unlock = () => {
      if (audioState() === "running") return;
      void unlockAudio().then(() => setLocked(audioState() !== "running"));
    };
    // Keep retrying on real gestures in case iOS blocks the first unlock.
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("touchstart", unlock, { capture: true });
    window.addEventListener("touchend", unlock, { capture: true });
    window.addEventListener("mousedown", unlock, { capture: true });
    window.addEventListener("click", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });

    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = (e.target as Element | null)?.closest<HTMLElement>("button, a");
      if (!el || el.dataset.silent !== undefined) return;
      if (el.contains(e.relatedTarget as Node)) return;
      uiBlip(Number(el.dataset.note) || 587);
    };
    const clickFx = (e: MouseEvent) => {
      if (audioState() !== "running") void unlockAudio();
      const el = (e.target as Element | null)?.closest<HTMLElement>("button, a");
      if (!el || el.dataset.silent !== undefined) return;
      uiBlip((Number(el.dataset.note) || 587) * 1.5, 0.055, 0.12);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.key === "f" || e.key === "F") {
        setTimeout(() => {                    // let a game claim F first (it's a piano key in Refrain)
          if (e.defaultPrevented) return;
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen().catch(() => {});
        }, 0);
      }
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("click", clickFx);
    document.addEventListener("keydown", onKey);
    // iOS suspends the context whenever the tab is backgrounded.
    const onVis = () => {
      if (document.visibilityState === "visible") setLocked(audioState() !== "running");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("click", clickFx);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("touchstart", unlock, { capture: true });
      window.removeEventListener("touchend", unlock, { capture: true });
      window.removeEventListener("mousedown", unlock, { capture: true });
      window.removeEventListener("click", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
    };
  }, []);

  const toggleFs = () => {
    void unlockAudio();
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <>
      {locked && !path.startsWith("/about") && (
        <button
          className="corner soundGate"
          data-silent
          onClick={() => {
            void unlockAudio().then(() => {
              const ok = audioState() === "running";
              setLocked(!ok);
              if (ok) uiBlip(660, 0.06, 0.14);
            });
          }}
        >
          Tap to enable sound
        </button>
      )}
      {path !== "/" && (
        <Link href="/" className="corner homeLink" data-note="349" aria-label="Back to games menu">
          <span className="homeLinkInner homeLinkLong">◂ Back to games</span>
          <span className="homeLinkInner homeLinkShort">◂ Menu</span>
        </Link>
      )}
      {!isTouchDevice && (
        <button
          className="corner fsBtn"
          onClick={toggleFs}
          title="Toggle fullscreen"
          aria-label="Toggle fullscreen"
          data-note="523"
        >
          <svg viewBox="0 0 24 24">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      )}
    </>
  );
}
