"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import ShareScore from "@/components/ShareScore";
import { Stagger, Item, Pop } from "@/components/Fx";
import { audio, click, uiBlip } from "@/lib/audio";
import { getBest, recordPlay, runRng, scoreKey, setBest, todayStamp, usePref } from "@/lib/store";
import { scoreCard, slotEmoji } from "@/lib/share";
import styles from "./page.module.css";

type Phase = "menu" | "reveal" | "ready" | "timing" | "feedback" | "results";

const SLOTS = 5;
const TAP_MS = 500;
const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "1.5–4 seconds", note: 523 },
  { key: "hard", label: "Hard", sub: "1–7 seconds", note: 659 },
  { key: "brutal", label: "Brutal", sub: "0.7–10 seconds", note: 784 },
];
const RANGES: Record<string, [number, number]> = {
  easy: [1500, 4000],
  hard: [1000, 7000],
  brutal: [700, 10000],
};

const scoreOf = (target: number, guess: number) =>
  10 * Math.exp(-3.5 * Math.abs(guess - target) / target);
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const signedError = (target: number, guess: number) => {
  const value = ((guess - target) / target) * 100;
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
};
const verdict = (total: number) =>
  total >= 46 ? "Atomic clock." :
  total >= 39 ? "Uncanny timing." :
  total >= 30 ? "Good instincts." :
  total >= 20 ? "Time got slippery." : "Lost in the moment.";

type ProgressStyle = CSSProperties & { "--progress": number };

export default function TimeGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = usePref("time-diff", "easy");
  const [targets, setTargets] = useState<number[]>([]);
  const [guesses, setGuesses] = useState<number[]>([]);
  const [slot, setSlot] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [runStamp, setRunStamp] = useState(0);
  const [record, setRecord] = useState(false);
  const startedAt = useRef(0);
  const feedbackAt = useRef(0);

  const start = () => {
    const rng = runRng();
    const [min, max] = RANGES[diff];
    const next = Array.from({ length: SLOTS }, () => Math.round((min + rng() * (max - min)) / 10) * 10);
    setTargets(next);
    setGuesses([]);
    setSlot(0);
    setElapsed(0);
    setRecord(false);
    setPhase("reveal");
  };

  useEffect(() => {
    if (phase !== "reveal" || !targets[slot]) return;
    const target = targets[slot];
    const began = performance.now();
    let frame = 0;
    let nextTimer = 0;
    let nextTap = 0;
    const tick = (now: number) => {
      const value = Math.min(target, now - began);
      setElapsed(value);
      if (value >= nextTap) {
        click(audio().currentTime, nextTap === 0, nextTap === 0 ? 1760 : 1320);
        nextTap = (Math.floor(value / TAP_MS) + 1) * TAP_MS;
      }
      if (value < target) {
        frame = requestAnimationFrame(tick);
        return;
      }
      uiBlip(880, 0.06, 0.16);
      nextTimer = window.setTimeout(() => {
        setElapsed(0);
        setPhase("ready");
      }, 650);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(nextTimer); };
  }, [phase, slot, targets]);

  useEffect(() => {
    if (phase !== "timing") return;
    let frame = 0;
    let nextTap = 0;
    const tick = (now: number) => {
      const value = now - startedAt.current;
      setElapsed(value);
      if (value >= nextTap) {
        click(audio().currentTime, nextTap === 0, nextTap === 0 ? 1760 : 1320);
        nextTap = (Math.floor(value / TAP_MS) + 1) * TAP_MS;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const beginTiming = () => {
    startedAt.current = performance.now();
    setElapsed(0);
    setPhase("timing");
  };

  const stopTiming = () => {
    if (phase !== "timing") return;
    const guess = Math.max(80, performance.now() - startedAt.current);
    const next = [...guesses, guess];
    setGuesses(next);
    setElapsed(guess);
    feedbackAt.current = performance.now();
    setPhase("feedback");
    uiBlip(880, 0.06, 0.16);
    if (slot === SLOTS - 1) {
      const total = targets.reduce((sum, target, index) => sum + scoreOf(target, next[index]), 0);
      const key = scoreKey("time", diff);
      const isRecord = total > getBest(key) && total > 0;
      if (isRecord) setBest(key, Math.round(total * 10) / 10);
      setRecord(isRecord);
      recordPlay("time");
      setRunStamp((value) => value + 1);
    }
  };

  const advance = () => {
    if (performance.now() - feedbackAt.current < 350) return;
    if (slot === SLOTS - 1) {
      setPhase("results");
      return;
    }
    setSlot((value) => value + 1);
    setElapsed(0);
    setPhase("reveal");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase !== "menu" && !document.fullscreenElement) {
        event.preventDefault();
        setPhase("menu");
        return;
      }
      if (event.key !== " " || event.repeat) return;
      event.preventDefault();
      if (phase === "ready") beginTiming();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== " " || phase !== "timing") return;
      event.preventDefault();
      stopTiming();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  });

  if (phase === "menu") {
    return (
      <main className="stage menuStage">
        <Stagger style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <Item><h1 className="wordmark">Second Sense</h1></Item>
          <Item><p className="tagline">Listen to a measured stretch of time, then immediately recreate it by holding down. Five rounds test your inner clock.</p></Item>
          <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <GameSetup game="time" diffs={DIFFS} diff={diff}
              onDiff={setDiff} onStart={start} refreshToken={runStamp}
              helpContent={{
                title: "Second Sense",
                description: "Experience each duration through a steady sequence of taps, then immediately reproduce it without seeing a clock.",
                steps: [
                  "Watch one orbit and listen to its half-second taps until the interval ends.",
                  "Press and hold the button or Space to replay the same tap pulse, then release at the remembered moment.",
                  "See your error, then repeat with the next duration; five rounds make your final score.",
                ],
              }} />
          </Item>
        </Stagger>
      </main>
    );
  }

  if (phase === "reveal") {
    const progress = targets[slot] ? elapsed / targets[slot] : 0;
    return (
      <main className={`stage ${styles.stage}`}>
        <div className={styles.eyebrow}>Feel duration {slot + 1} of {SLOTS}</div>
        <div className={styles.dial} style={{ "--progress": progress } as ProgressStyle} aria-hidden>
          <div className={styles.core}>
            <span>Watch</span>
            <strong>{slot + 1}</strong>
          </div>
        </div>
        <div className="hint">Listen to the taps · feel the interval</div>
      </main>
    );
  }

  if (phase === "ready" || phase === "timing") {
    return (
      <main className={`stage ${styles.stage}`}>
        <div className={styles.eyebrow}>Recreate duration {slot + 1} of {SLOTS}</div>
        <div className={`${styles.dial} ${phase === "timing" ? styles.pulse : ""}`} style={{ "--progress": 0 } as ProgressStyle}>
          <div className={styles.core}>
            <span>{phase === "ready" ? "When ready" : "Clock hidden"}</span>
            <strong>{phase === "ready" ? "Feel it" : "Now"}</strong>
          </div>
        </div>
        <button
          key={phase}
          className={`cta ${styles.action}`}
          data-note={phase === "ready" ? 440 : 880}
          onClick={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (phase !== "ready") return;
            event.currentTarget.setPointerCapture(event.pointerId);
            beginTiming();
          }}
          onPointerUp={stopTiming}
          onPointerCancel={stopTiming}
        >
          {phase === "ready" ? "Press and hold" : "Release to stop"}
        </button>
        <div className="hint">Hold button or space · match the taps</div>
      </main>
    );
  }

  if (phase === "feedback") {
    const target = targets[slot];
    const guess = guesses[slot];
    const score = scoreOf(target, guess);
    return (
      <main className="stage">
        <Pop className={styles.feedback}>
          <div className={styles.eyebrow}>Duration {slot + 1} · {score.toFixed(1)} / 10</div>
          <div className={styles.delta}>{signedError(target, guess)}</div>
          <div className={styles.comparison}>
            <div><span>Target</span><b>{seconds(target)}</b></div>
            <div><span>You</span><b>{seconds(guess)}</b></div>
          </div>
          <button className={`cta ${styles.action}`} data-note={659} onClick={advance}>
            {slot === SLOTS - 1 ? "See results" : "Next duration"}
          </button>
        </Pop>
      </main>
    );
  }

  const scores = targets.map((target, index) => scoreOf(target, guesses[index]));
  const total = scores.reduce((sum, score) => sum + score, 0);
  const best = getBest(scoreKey("time", diff));
  return (
    <main className="stage resStage">
      <Pop className="resHead">
        <h1 className="resVerdict">{verdict(total)}</h1>
        <div className="resTotal"><b>{total.toFixed(1)}</b> / 50 · best {best.toFixed(1)}</div>
        {record && <div className="record">New best</div>}
      </Pop>
      <div className={styles.resultGrid}>
        {targets.map((target, index) => (
          <div className={styles.resultCell} key={target + index}>
            <b>{signedError(target, guesses[index])}</b>
            <span>{seconds(target)} target</span>
            <span>{seconds(guesses[index])} yours</span>
          </div>
        ))}
      </div>
      <div className="resActions">
        <button className="cta" data-note={523} onClick={start}>Again</button>
        <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Menu</button>
        <ShareScore text={scoreCard("Second Sense", `${diff} · ${todayStamp()}`,
          `${total.toFixed(1)} / 50 | Grades: ${scores.map(slotEmoji).join(" ")}`,
          "time", diff)} />
      </div>
    </main>
  );
}