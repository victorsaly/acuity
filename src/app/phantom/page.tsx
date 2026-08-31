"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import { Item, Pop, Stagger } from "@/components/Fx";
import { audio, bass, clap, click, hat, heardNow, kick } from "@/lib/audio";
import ShareScore from "@/components/ShareScore";
import { getBest, recordPlay, scoreKey, setBest, usePref } from "@/lib/store";
import { barEmoji } from "@/lib/share";
import styles from "./page.module.css";

type Phase = "menu" | "groove" | "silence" | "feedback" | "results";
type Result = { error: number | null; score: number };
type BarStyle = CSSProperties & { "--height": string; "--delay": string };

const ROUNDS = 3;
const GROOVE_BEATS = 8;
/** How far past the phantom 1 a tap still counts as an answer rather than a miss. */
const GRACE_BEATS = 2;
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

/* Score namespace. Bumped when a rules change makes old numbers
   incomparable: before 2026-08-31 the drop sounded at the target, so bests
   were set by reacting to it rather than counting through the silence.
   Play counts and streaks still key off "phantom". */
const SCORE = "phantom-v2";

/** The drop, as one stacked hit. Only ever heard as feedback, never as a cue. */
function drop(at: number, semis: number) {
  kick(at, 1);
  clap(at, 0.85);
  hat(at, true, 0.65);
  bass(at, semis, 1);
}

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
  const frame = useRef(0);
  const lastBeat = useRef(-1);
  const settled = useRef(false);
  const phaseRef = useRef<Phase>("menu");
  const roundRef = useRef(0);
  /* The whole round lives on the audio clock: the groove is scheduled against
     it, the phantom 1 is a point on it, and taps are read off it. Judging a
     rhythm game on performance.now() while the beats play on currentTime lets
     the two drift by tens of milliseconds — most of a scoring window. */
  const plan = useRef({ beat: 0, startCtx: 0, silenceCtx: 0, targetCtx: 0, deadlineCtx: 0 });

  const stop = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  };

  const goPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => stop, []);

  const completeRound = (tapCtx: number | null) => {
    if (settled.current) return;
    settled.current = true;
    stop();
    const { targetCtx } = plan.current;
    const error = tapCtx === null ? null : (tapCtx - targetCtx) * 1000;
    const timingWindow = CONFIG[diff].window;
    const score = error === null ? 0 : Math.max(0, 10 * (1 - Math.abs(error) / timingWindow));
    const semis = roundRef.current % 2 ? 3 : 0;
    const context = audio();

    /* Replay what happened: your tap against the 1 you were aiming at, spaced
       by the error you actually made, so a 200ms rush is something you hear
       rather than a number you read. */
    const errorSeconds = (error ?? 0) / 1000;
    if (error === null) {
      drop(context.currentTime + 0.45, semis);
    } else {
      click(context.currentTime, true, 1318);                       // your tap, immediately
      const yours = context.currentTime + 0.75 + Math.max(0, errorSeconds);
      click(yours, true, 1318);
      drop(yours - errorSeconds, semis);
    }

    const result = { error, score };
    setCurrent(result);
    setResults((value) => [...value, result]);
    goPhase("feedback");
  };

  const beginRound = (roundIndex: number) => {
    stop();
    const { bpm, gap } = CONFIG[diff];
    const beat = 60 / bpm;
    const context = audio();
    const startCtx = context.currentTime + 0.7;
    const silenceCtx = startCtx + GROOVE_BEATS * beat;
    const targetCtx = silenceCtx + gap * beat;
    plan.current = {
      beat,
      startCtx,
      silenceCtx,
      targetCtx,
      deadlineCtx: targetCtx + GRACE_BEATS * beat,
    };
    settled.current = false;
    lastBeat.current = -1;
    roundRef.current = roundIndex;
    setRound(roundIndex);
    setCurrent(null);
    setGrooveBeat(0);
    goPhase("groove");

    for (let index = 0; index < GROOVE_BEATS; index++) {
      const when = startCtx + index * beat;
      kick(when, index === 0 ? 0.96 : 0.78);
      if (index % 2 === 1) clap(when, 0.62);
      hat(when, false, 0.34);
      if (index % 2 === 0) bass(when, index % 4 === 0 ? 0 : 3, 0.66);
    }

    /* Nothing is scheduled at the phantom 1 — that is the whole game. An
       audible drop there would turn counting into reacting, and reacting
       always wins. */
    const tick = () => {
      const t = heardNow();
      const p = plan.current;
      if (t < p.silenceCtx) {
        const index = Math.floor((t - p.startCtx) / p.beat);
        if (index >= 0 && index !== lastBeat.current) {
          lastBeat.current = index;
          setGrooveBeat(Math.min(GROOVE_BEATS, index + 1));
          setPulse((value) => value + 1);
        }
      } else if (phaseRef.current === "groove") {
        goPhase("silence");
      }
      if (t >= p.deadlineCtx) {
        completeRound(null);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const start = () => {
    setResults([]);
    setRecord(false);
    beginRound(0);
  };

  const tap = () => {
    if (phaseRef.current !== "silence") return;
    completeRound(heardNow());
  };

  const advance = () => {
    if (round + 1 < ROUNDS) {
      beginRound(round + 1);
      return;
    }
    const total = results.reduce((sum, result) => sum + result.score, 0);
    const key = scoreKey(SCORE, diff);
    const rounded = Math.round(total * 10) / 10;
    const isRecord = rounded > getBest(key) && rounded > 0;
    if (isRecord) setBest(key, rounded);
    recordPlay("phantom");
    setRecord(isRecord);
    setRunStamp((value) => value + 1);
    goPhase("results");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase !== "menu" && !document.fullscreenElement) {
        event.preventDefault();
        stop();
        settled.current = true;
        goPhase("menu");
        return;
      }
      if ((event.key === " " || event.key === "Enter") && phase === "silence" && !event.repeat) {
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
          <Item><p className="tagline">Listen, hands off. The beat cuts out and never comes back. Keep counting anyway, then tap once where the next 1 belongs.</p></Item>
          <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <GameSetup game={SCORE} diffs={DIFFS} diff={diff} onDiff={setDiff} onStart={start} refreshToken={runStamp}
              helpContent={{
                title: "Phantom Drop",
                description: "You hear the groove, the groove disappears, and you have to keep counting anyway.",
                steps: [
                  "Two bars play. Count 1, 2, 3, 4 with the screen. Hands off.",
                  "The sound cuts. Keep counting the silent bars in your head.",
                  "Tap once on the next 1. Nothing marks it for you — the drop only sounds afterwards, so you can hear how close you were.",
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
            <small>{current.error === null ? "You never called it" : early ? "early" : "late"}</small>
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
    const best = getBest(scoreKey(SCORE, diff));
    return (
      <main className={`stage ${styles.stage}`}>
        <Pop className={styles.feedback}>
          <h1 className="resVerdict">{verdict(total)}</h1>
          <div className={styles.score}>{total.toFixed(1)}<small> / 30</small></div>
          <div className="resTotal">best {best.toFixed(1)}</div>
          {record && <div className="record">New best</div>}
          <div className="resActions">
            <button className="cta" data-note={523} onClick={start}>Again</button>
            <ShareScore
              game="Phantom Drop"
              route="phantom"
              detail={diff}
              line={`${total.toFixed(1)} / 30 ${barEmoji((total / 30) * 100)} · ${results.filter((r) => r.score >= 9).length}/${ROUNDS} landed`}
              level={diff}
            />
            <button className="ghost" data-note={349} onClick={() => goPhase("menu")}>Menu</button>
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
        aria-label={phase === "groove" ? "Listen only" : "Tap on the predicted next downbeat"}
        onPointerDown={tap}
      />
      <div className={`${styles.eyebrow} ${phase === "groove" ? styles.listen : styles.yourTurn}`}>
        {phase === "groove" ? "Listen only · do not tap" : "Your turn · nothing will cue you"}
      </div>
      <div className={styles.round}>
        {phase === "groove" ? `Bar ${grooveBar} of 2 · count ${count}` : `Drop ${round + 1} of ${ROUNDS}`}
      </div>
      <div key={`${pulse}-${phase}`} className={`${styles.scene} ${phase === "groove" ? styles.beat : styles.silence}`} aria-hidden>
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
        <div className={styles.count}>{phase === "groove" ? count : "?"}</div>
      </div>
      <div className={styles.instruction}>
        {phase === "groove" ? "Follow 1 · 2 · 3 · 4" : `Count ${silentBars} hidden ${silentBars === 1 ? "bar" : "bars"} in your head`}
        <small>{phase === "groove" ? "Just listen · tapping is locked" : "Then tap the 1 · you hear the drop only after you call it"}</small>
      </div>
    </main>
  );
}
