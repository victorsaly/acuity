"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { audio, uiBlip } from "@/lib/audio";

/**
 * App-wide chrome: fullscreen toggle, home link, and the rollover
 * sound layer — every button and link answers a hover with a soft
 * blip (its data-note pitch, or a default), and clicks confirm a
 * fifth higher. Audio unlocks on the first press anywhere.
 */
export default function Chrome() {
  const path = usePathname();
  const router = useRouter();

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
    const unlock = () => audio();
    addEventListener("pointerdown", unlock, { once: true, capture: true });

    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = (e.target as Element | null)?.closest<HTMLElement>("button, a");
      if (!el || el.dataset.silent !== undefined) return;
      if (el.contains(e.relatedTarget as Node)) return;
      uiBlip(Number(el.dataset.note) || 587);
    };
    const clickFx = (e: MouseEvent) => {
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
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("click", clickFx);
      document.removeEventListener("keydown", onKey);
      removeEventListener("pointerdown", unlock, { capture: true });
    };
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <>
      {path !== "/" && (
        <Link href="/" className="corner homeLink" data-note="349">
          ◂ Games
        </Link>
      )}
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
    </>
  );
}
