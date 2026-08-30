"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getBest, scoreKey } from "@/lib/store";

export type DiffDef = { key: string; label: string; sub: string; note: number };

const noopSubscribe = () => () => {};

/**
 * Shared menu block: difficulty pills, start button, best-score line.
 */
export default function GameSetup({
  game, diffs, diff, onDiff, onStart, refreshToken,
  sounds, sound, onSound, formats, format, onFormat, beats, beat, onBeat,
  helpContent, formatBest,
}: {
  game: string;
  diffs: DiffDef[];
  diff: string;
  onDiff: (d: string) => void;
  onStart: () => void;
  refreshToken?: unknown;
  sounds?: { key: string; label: string }[];
  sound?: string;
  onSound?: (k: string) => void;
  formats?: { key: string; label: string }[];
  format?: string;
  onFormat?: (k: string) => void;
  beats?: { key: string; label: string; sub?: string }[];
  beat?: string;
  onBeat?: (k: string) => void;
  helpContent?: { title: string; description: string; steps: string[] };
  /** Render the best score; defaults to one decimal. Level-based games pass their own. */
  formatBest?: (best: number) => string;
}) {
  const [showHelp, setShowHelp] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const appliedSharedLevel = useRef(false);
  const hasExtraOptions = Boolean((sounds && onSound) || (formats && onFormat) || (beats && onBeat));

  useEffect(() => {
    if (appliedSharedLevel.current) return;
    appliedSharedLevel.current = true;
    const sharedLevel = new URLSearchParams(window.location.search).get("level");
    if (sharedLevel && sharedLevel !== diff && diffs.some(({ key }) => key === sharedLevel)) {
      onDiff(sharedLevel);
    }
  }, [diff, diffs, onDiff]);

  /* localStorage read that is SSR-safe and refreshes whenever props change */
  const best = useSyncExternalStore(
    noopSubscribe,
    () => {
      void refreshToken;
      return getBest(scoreKey(game, diff));
    },
    () => 0,
  );

  /* keyboard: 1–N picks difficulty, Enter/Space starts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= diffs.length) { onDiff(diffs[n - 1].key); return; }
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
      if ((e.key === "b" || e.key === "B") && beats && onBeat) {
        const i = beats.findIndex((b) => b.key === beat);
        onBeat(beats[(i + 1) % beats.length].key);
        return;
      }
      const idleFocus = !document.activeElement || document.activeElement === document.body;
      if ((e.key === "Enter" || e.key === " ") && idleFocus) { e.preventDefault(); onStart(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [diffs, onDiff, onStart, sounds, sound, onSound, formats, format, onFormat, beats, beat, onBeat]);

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
      {hasExtraOptions && (
        <div className="optionToggleWrap">
          <button
            type="button"
            className="ghost optionToggle"
            data-note="349"
            onClick={() => setShowOptions((v) => !v)}
            aria-expanded={showOptions}
          >
            {showOptions ? "Hide options" : "More options"}
          </button>
        </div>
      )}
      {showOptions && (
        <>
          {beats && onBeat && (
            <div className="modes beatRow" role="group" aria-label="Beat">
              {beats.map((b, i) => (
                <button
                  key={b.key}
                  className="mode"
                  aria-pressed={beat === b.key}
                  data-note={330 + i * 44}
                  onClick={() => onBeat(b.key)}
                >
                  {b.label}
                  {b.sub && <small> {b.sub}</small>}
                </button>
              ))}
            </div>
          )}
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
        </>
      )}
      <div className="menuActions">
        {helpContent && (
          <button className="ghost helpToggle" data-note="349" onClick={() => setShowHelp(true)}>
            How to play
          </button>
        )}
        <button className="cta" data-note="440" onClick={onStart}>
          Start
        </button>
      </div>
      {showHelp && helpContent && (
        <div className="helpOverlay" role="dialog" aria-modal="true" aria-label={helpContent.title} onClick={() => setShowHelp(false)}>
          <div className="helpPanel" onClick={(e) => e.stopPropagation()}>
            <div className="helpHeader">
              <h2>{helpContent.title}</h2>
              <button className="ghost helpClose" data-note="349" onClick={() => setShowHelp(false)}>
                Close
              </button>
            </div>
            <p>{helpContent.description}</p>
            <ol className="helpSteps">
              {helpContent.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
      <div className="best">
        {best > 0
          ? `Best · ${diff} · ${formatBest ? formatBest(best) : best.toFixed(1)}`
          : `No score yet · ${diff}`}
      </div>
      <div className="kbd">
        <span><b>1–{diffs.length}</b>difficulty</span>
        {sounds && <span><b>S</b>sound</span>}
        {beats && <span><b>B</b>beat</span>}
        {formats && <span><b>L</b>format</span>}
        <span><b>↵</b>start</span>
        <span><b>Esc</b>menu</span>
        <span><b>F</b>fullscreen</span>
      </div>
    </>
  );
}
