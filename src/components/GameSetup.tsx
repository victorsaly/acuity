"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Mode } from "@/lib/store";
import { getBest, scoreKey } from "@/lib/store";

export type DiffDef = { key: string; label: string; sub: string; note: number };

const noopSubscribe = () => () => {};

/**
 * Shared menu block: difficulty pills, free/daily mode toggle,
 * start button, best-score line.
 */
export default function GameSetup({
  game, diffs, diff, mode, onDiff, onMode, onStart, refreshToken,
  sounds, sound, onSound, formats, format, onFormat,
}: {
  game: string;
  diffs: DiffDef[];
  diff: string;
  mode: Mode;
  onDiff: (d: string) => void;
  onMode: (m: Mode) => void;
  onStart: () => void;
  refreshToken?: unknown;
  sounds?: { key: string; label: string }[];
  sound?: string;
  onSound?: (k: string) => void;
  formats?: { key: string; label: string }[];
  format?: string;
  onFormat?: (k: string) => void;
}) {
  /* localStorage read that is SSR-safe and refreshes whenever props change */
  const best = useSyncExternalStore(
    noopSubscribe,
    () => {
      void refreshToken;
      return getBest(scoreKey(game, mode, diff));
    },
    () => 0,
  );

  /* keyboard: 1–N picks difficulty, D toggles daily, Enter/Space starts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= diffs.length) { onDiff(diffs[n - 1].key); return; }
      if (e.key === "d" || e.key === "D") { onMode(mode === "free" ? "daily" : "free"); return; }
      if ((e.key === "s" || e.key === "S") && sounds && onSound) {
        const i = sounds.findIndex((s) => s.key === sound);
        onSound(sounds[(i + 1) % sounds.length].key);
        return;
      }
      if ((e.key === "l" || e.key === "L") && formats && onFormat) {
        const i = formats.findIndex((f) => f.key === format);
        onFormat(formats[(i + 1) % formats.length].key);
        return;
      }
      const idleFocus = !document.activeElement || document.activeElement === document.body;
      if ((e.key === "Enter" || e.key === " ") && idleFocus) { e.preventDefault(); onStart(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [diffs, mode, onDiff, onMode, onStart, sounds, sound, onSound, formats, format, onFormat]);

  return (
    <>
      <div className="diffs" role="group" aria-label="Difficulty">
        {diffs.map((d) => (
          <button
            key={d.key}
            className="diff"
            aria-pressed={diff === d.key}
            data-note={d.note}
            onClick={() => onDiff(d.key)}
          >
            {d.label}
            <small>{d.sub}</small>
          </button>
        ))}
      </div>
      {sounds && onSound && (
        <div className="modes" role="group" aria-label="Sound">
          {sounds.map((s, i) => (
            <button
              key={s.key}
              className="mode"
              aria-pressed={sound === s.key}
              data-note={440 + i * 52}
              onClick={() => onSound(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {formats && onFormat && (
        <div className="modes" role="group" aria-label="Format">
          {formats.map((f, i) => (
            <button
              key={f.key}
              className="mode"
              aria-pressed={format === f.key}
              data-note={392 + i * 60}
              onClick={() => onFormat(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      <div className="modes" role="group" aria-label="Mode">
        <button className="mode" aria-pressed={mode === "free"} data-note="392" onClick={() => onMode("free")}>
          Free play
        </button>
        <button className="mode" aria-pressed={mode === "daily"} data-note="494" onClick={() => onMode("daily")}>
          Daily
        </button>
      </div>
      <button className="cta" data-note="440" onClick={onStart}>
        Start
      </button>
      <div className="best">
        {best > 0
          ? `Best · ${mode} · ${diff} · ${best.toFixed(1)}`
          : `No score yet · ${mode} · ${diff}`}
      </div>
      {mode === "daily" && (
        <div className="dailyNote">Same puzzle for everyone today — new one at midnight.</div>
      )}
      <div className="kbd">
        <span><b>1–{diffs.length}</b>difficulty</span>
        {sounds && <span><b>S</b>sound</span>}
        {formats && <span><b>L</b>lane</span>}
        <span><b>D</b>daily</span>
        <span><b>↵</b>start</span>
        <span><b>Esc</b>menu</span>
        <span><b>F</b>fullscreen</span>
      </div>
    </>
  );
}
