"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import { Item, Pop, Stagger } from "@/components/Fx";
import { audio, bass, clap, hat, kick } from "@/lib/audio";
import { getBest, recordPlay, scoreKey, setBest, usePref } from "@/lib/store";
import styles from "./page.module.css";

type Phase = "menu" | "groove" | "silence" | "drop" | "feedback" | "results";
type Result = { error: number | null; score: number };
type BarStyle = CSSProperties & { "--height": string; "--delay": string };

const ROUNDS = 3;
const GROOVE_BEATS = 8;
const RESPONSE_MS = 1500;
const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "1 silent bar", note: 523 },
  { key: "hard", label: "Hard", sub: "2 silent bars", note: 659 },
  { key: "brutal", label: "Brutal", sub: "3 silent bars", note: 784 },
];
const DIFF_KEYS = DIFFS.map((d) => d.key);
const CONFIG: Record<string, { bpm: number; gap: number; window: number }> = {
  easy: { bpm: 100, gap: 4, window: 900 },
  hard: { bpm: 118, gap: 8, window: 700 },
  brutal: { bpm: 136, gap: 12, window: 500 },
};
const BAR_HEIGHTS = [22, 48, 78, 42, 112, 64, 34, 92, 54, 126, 70, 38, 84, 50, 108, 58, 30, 74, 46, 98, 62, 28, 82, 44];

const verdict = (score: number) =>
  score >= 27 ? "You heard the silence." :
  score >= 21 ? "Still in the pocket." :
  score >= 12 ? "The void bent time." : "Drop privileges revoked.";

export default function PhantomGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = usePref("phantom-diff", "easy", DIFF_KEYS);
  const [round, setRound] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [grooveBeat, setGrooveBeat] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [current, setCurrent] = useState<Result | null>(null);
  const [record, setRecord] = useState(false);
  const [runStamp, setRunStamp] = useState(0);
  const timers = useRef<number[]>([]);
  const targetAt = useRef(0);
  const settled = useRef(false);
  const dropPlayed = useRef(false);

  const clear = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  };

  useEffect(() => clear, []);

  const hitDrop = () => {
    if (dropPlayed.current) return;
    dropPlayed.current = true;
    const context = audio();
    const now = context.currentTime;
    kick(now, 1);
    clap(now, 0.85);
    hat(now, true, 0.65);
    bass(now, round % 2 ? 3 : 0, 1);
  };

  const completeRound = (tapAt: number | null) => {
    if (settled.current) return;
    settled.current = true;
    const error = tapAt === null ? null : tapAt - targetAt.current;
    const timingWindow = CONFIG[diff].window;
    const score = error === null ? 0 : Math.max(0, 10 * (1 - Math.abs(error) / timingWindow));
    const result = { error, score };
    hitDrop();
    setCurrent(result);
    setResults((value) => [...value, result]);
    setPhase("feedback");
  };

  const beginRound = (roundIndex: number) => {
    clear();
    const { bpm, gap } = CONFIG[diff];
    const beatSeconds = 60 / bpm;
    const beatMs = beatSeconds * 1000;
    const context = audio();
    const audioStart = context.currentTime + 0.65;
    const visualStart = performance.now() + 650;
    settled.current = false;
    dropPlayed.current = false;
    setRound(roundIndex);
    setCurrent(null);
    setGrooveBeat(0);
    setPhase("groove");

    for (let index = 0; index < GROOVE_BEATS; index++) {
      const when = audioStart + index * beatSeconds;
      kick(when, index === 0 ? 0.96 : 0.78);
      if (index % 2 === 1) clap(when, 0.62);
      hat(when, false, 0.34);
      if (index % 2 === 0) bass(when, index % 4 === 0 ? 0 : 3, 0.66);
      const pulseTimer = window.setTimeout(
        () => {
          setGrooveBeat(index + 1);
          setPulse((value) => value + 1);
        },
        Math.max(0, visualStart + index * beatMs - performance.now()),
      );
      timers.current.push(pulseTimer);
    }

    const silenceAt = visualStart + GROOVE_BEATS * beatMs;
    targetAt.current = silenceAt + gap * beatMs;
    const silenceTimer = window.setTimeout(
      () => setPhase("silence"),
      Math.max(0, silenceAt - performance.now()),
    );
    const dropTimer = window.setTimeout(
      () => {
        hitDrop();
        setPulse((value) => value + 1);
        setPhase("drop");
        const missTimer = window.setTimeout(() => completeRound(null), RESPONSE_MS);
        timers.current.push(missTimer);
      },
      Math.max(0, targetAt.current - performance.now()),
    );
    timers.current.push(silenceTimer, dropTimer);
  };

  const start = () => {
    setResults([]);
    setRecord(false);
    beginRound(0);
  };

  const tap = () => {
    completeRound(performance.now());
  };

  const advance = () => {
    if (round + 1 < ROUNDS) {
      beginRound(round + 1);
      return;
    }
    const total = results.reduce((sum, result) => sum + result.score, 0);
    const key = scoreKey("phantom", diff);
    const rounded = Math.round(total * 10) / 10;
    const isRecord = rounded > getBest(key) && rounded > 0;
    if (isRecord) setBest(key, rounded);
    recordPlay("phantom");
    setRecord(isRecord);
    setRunStamp((value) => value + 1);
    setPhase("results");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase !== "menu" && !document.fullscreenElement) {
        event.preventDefault();
        clear();
        setPhase("menu");
        return;
      }
      if ((event.key === " " || event.key === "Enter") && (phase === "silence" || phase === "drop") && !event.repeat) {
        event.preventDefault();
        tap();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (phase === "menu") {
    return (
      <main className={`stage menuStage ${styles.stage}`}>
        <Stagger style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <Item><div className={styles.menuMark} aria-hidden><div className={styles.void} /></div></Item>
          <Item><h1 className="wordmark">Phantom Drop</h1></Item>
          <Item><p className="tagline">Listen, hands off. The beat cuts out. Keep counting anyway, then tap once where the next 1 belongs.</p></Item>
          <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <GameSetup game="phantom" diffs={DIFFS} diff={diff} onDiff={setDiff} onStart={start} refreshToken={runStamp}
              helpContent={{
                title: "Phantom Drop",
                description: "You hear the groove, the groove disappears, and you have to keep counting anyway.",
                steps: [
                  "Two bars play. Count 1, 2, 3, 4 with the screen. Hands off.",
                  "The sound cuts. Keep counting the silent bar in your head.",
                  "After the hidden 4, tap once on the next 1. Three drops, one score.",
                ],
              }} />
          </Item>
        </Stagger>
      </main>
    );
  }

  if (phase === "feedback" && current) {
    const early = current.error !== null && current.error < 0;
    return (
      <main className={`stage ${styles.stage}`}>
        <Pop className={styles.feedback}>
          <div className={styles.delta}>
            {current.error === null ? "Miss" : `${Math.abs(Math.round(current.error))}ms`}
            <small>{current.error === null ? "The drop escaped" : early ? "early" : "late"}</small>
          </div>
          <p>{current.score.toFixed(1)} / 10 · drop {round + 1} of {ROUNDS}</p>
          <div className="resActions">
            <button className="cta" data-note={659} onClick={advance}>{round + 1 < ROUNDS ? "Next drop" : "See results"}</button>
          </div>
        </Pop>
      </main>
    );
  }

  if (phase === "results") {
    const total = results.reduce((sum, result) => sum + result.score, 0);
    const best = getBest(scoreKey("phantom", diff));
    return (
      <main className={`stage ${styles.stage}`}>
        <Pop className={styles.feedback}>
          <h1 className="resVerdict">{verdict(total)}</h1>
          <div className={styles.score}>{total.toFixed(1)}<small> / 30</small></div>
          <div className="resTotal">best {best.toFixed(1)}</div>
          {record && <div className="record">New best</div>}
          <div className="resActions">
            <button className="cta" data-note={523} onClick={start}>Again</button>
            <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Menu</button>
          </div>
        </Pop>
      </main>
    );
  }

  const count = ((Math.max(1, grooveBeat) - 1) % 4) + 1;
  const grooveBar = Math.min(2, Math.ceil(Math.max(1, grooveBeat) / 4));
  const silentBars = CONFIG[diff].gap / 4;

  return (
    <main className={`stage ${styles.stage} ${styles.playStage}`}>
      <button
        className={styles.tapTarget}
        data-silent
        disabled={phase === "groove"}
        aria-label={phase === "groove" ? "Listen only" : phase === "drop" ? "Tap now after the drop" : "Tap on the predicted next downbeat"}
        onPointerDown={tap}
      />
      <div className={`${styles.eyebrow} ${phase === "groove" ? styles.listen : styles.yourTurn}`}>
        {phase === "groove" ? "Listen only · do not tap" : phase === "drop" ? "Drop · tap now" : "Your turn · sound is off"}
      </div>
      <div className={styles.round}>
        {phase === "groove" ? `Bar ${grooveBar} of 2 · count ${count}` : `Drop ${round + 1} of ${ROUNDS}`}
      </div>
      <div key={`${pulse}-${phase}`} className={`${styles.scene} ${phase === "groove" ? styles.beat : phase === "drop" ? styles.drop : styles.silence}`} aria-hidden>
        <div className={styles.wave}>
          {BAR_HEIGHTS.map((height, index) => (
            <span
              className={styles.bar}
              style={{ "--height": `${height}px`, "--delay": `${(index % 6) * 12}ms` } as BarStyle}
              key={index}
            />
          ))}
        </div>
        <div className={styles.hole} />
        <div className={styles.count}>{phase === "groove" ? count : phase === "drop" ? "1" : "?"}</div>
      </div>
      <div className={styles.instruction}>
        {phase === "groove" ? "Follow 1 · 2 · 3 · 4" : phase === "drop" ? "Tap now" : `Count ${silentBars} hidden ${silentBars === 1 ? "bar" : "bars"} in your head`}
        <small>{phase === "groove" ? "Just listen · tapping is locked" : phase === "drop" ? "Tap now · 1.5 second response window" : "Count 1 · 2 · 3 · 4 · tap on the next 1, or react when it drops"}</small>
      </div>
    </main>
  );
}