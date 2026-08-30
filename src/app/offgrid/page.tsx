"use client";

import { useEffect, useRef, useState } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import { Item, Pop, Stagger } from "@/components/Fx";
import { audio, buzz, clap, hat, kick, uiBlip } from "@/lib/audio";
import { getBest, recordPlay, runRng, scoreKey, setBest, usePref } from "@/lib/store";
import styles from "./page.module.css";

type Phase = "menu" | "listen" | "pick" | "feedback" | "results";
type Result = { culprit: number; picked: number | null; offset: number; score: number };

const ROUNDS = 5;
const STEPS = 8;
const PASSES = 3;
const PICK_MS = 6000;
const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "96 BPM · fat nudge", note: 523 },
  { key: "hard", label: "Hard", sub: "112 BPM · thin nudge", note: 659 },
  { key: "brutal", label: "Brutal", sub: "128 BPM · hair thin", note: 784 },
];
const CONFIG: Record<string, { bpm: number; startMs: number; endMs: number }> = {
  easy: { bpm: 96, startMs: 85, endMs: 48 },
  hard: { bpm: 112, startMs: 55, endMs: 28 },
  brutal: { bpm: 128, startMs: 32, endMs: 14 },
};

const verdict = (score: number) =>
  score >= 45 ? "Grid surgeon." :
  score >= 35 ? "Quantized ears." :
  score >= 20 ? "Loose but listening." : "Everything sounded fine to you.";

export default function OffGridGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = usePref("offgrid-diff", "easy");
  const [round, setRound] = useState(0);
  const [pass, setPass] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);
  const [revealing, setRevealing] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [current, setCurrent] = useState<Result | null>(null);
  const [record, setRecord] = useState(false);
  const [runStamp, setRunStamp] = useState(0);
  const timers = useRef<number[]>([]);
  const rng = useRef(runRng());
  const culprit = useRef(1);
  const offset = useRef(0);
  const settled = useRef(false);

  const clear = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  };

  useEffect(() => clear, []);

  const stepSeconds = () => 60 / CONFIG[diff].bpm / 2; // eighth notes

  /** Schedule one pass of the loop: audio on the WebAudio clock, lights via timeouts. */
  const schedulePass = (audioAt: number, visualAt: number, nudged: boolean, reveal: boolean) => {
    const stepSec = stepSeconds();
    for (let step = 0; step < STEPS; step++) {
      const late = nudged && step === culprit.current ? offset.current / 1000 : 0;
      const when = audioAt + step * stepSec + late;
      if (step === 0) kick(when, 0.9);
      if (step === 4) clap(when, 0.5);
      hat(when, false, step === 0 ? 0.42 : 0.3);
      const lightAt = visualAt + step * stepSec * 1000 + (reveal ? late * 1000 : 0);
      const timer = window.setTimeout(() => setActiveStep(step), Math.max(0, lightAt - performance.now()));
      timers.current.push(timer);
    }
  };

  const beginRound = (roundIndex: number) => {
    clear();
    const { startMs, endMs } = CONFIG[diff];
    const stepMs = stepSeconds() * 1000;
    const passMs = STEPS * stepMs;
    offset.current = startMs + ((endMs - startMs) * roundIndex) / (ROUNDS - 1);
    // never slot 1 (the anchor), never the same culprit twice in a row
    let next = 1 + Math.floor(rng.current() * (STEPS - 1));
    if (next === culprit.current) next = 1 + (next % (STEPS - 1));
    culprit.current = next;
    settled.current = false;
    setRound(roundIndex);
    setCurrent(null);
    setActiveStep(-1);
    setRevealing(false);
    setPass(0);
    setPhase("listen");

    const context = audio();
    const audioStart = context.currentTime + 0.65;
    const visualStart = performance.now() + 650;
    for (let p = 0; p < PASSES; p++) {
      schedulePass(audioStart + (p * passMs) / 1000, visualStart + p * passMs, true, false);
      const passTimer = window.setTimeout(
        () => setPass(p),
        Math.max(0, visualStart + p * passMs - performance.now()),
      );
      timers.current.push(passTimer);
    }
    const pickTimer = window.setTimeout(() => {
      setActiveStep(-1);
      setPhase("pick");
    }, Math.max(0, visualStart + PASSES * passMs + 120 - performance.now()));
    const missTimer = window.setTimeout(
      () => judge(null),
      Math.max(0, visualStart + PASSES * passMs + 120 + PICK_MS - performance.now()),
    );
    timers.current.push(pickTimer, missTimer);
  };

  const judge = (picked: number | null) => {
    if (settled.current) return;
    settled.current = true;
    clear();
    const hit = picked === culprit.current;
    const near = picked !== null && Math.abs(picked - culprit.current) === 1;
    const score = hit ? 10 : near ? 3 : 0;
    const result = { culprit: culprit.current, picked, offset: offset.current, score };
    if (hit) { uiBlip(880, 0.07); clap(audio().currentTime, 0.7); } else buzz();
    setCurrent(result);
    setResults((value) => [...value, result]);
    setActiveStep(-1);
    setPhase("feedback");
    // teach the ear: replay one pass with the culprit flashing at its true, late moment
    const replayTimer = window.setTimeout(() => {
      setRevealing(true);
      const context = audio();
      schedulePass(context.currentTime + 0.05, performance.now() + 50, true, true);
      const doneTimer = window.setTimeout(
        () => { setRevealing(false); setActiveStep(-1); },
        STEPS * stepSeconds() * 1000 + 400,
      );
      timers.current.push(doneTimer);
    }, 700);
    timers.current.push(replayTimer);
  };

  const start = () => {
    rng.current = runRng();
    setResults([]);
    setRecord(false);
    beginRound(0);
  };

  const advance = () => {
    clear();
    setRevealing(false);
    if (round + 1 < ROUNDS) {
      beginRound(round + 1);
      return;
    }
    const total = results.reduce((sum, result) => sum + result.score, 0);
    const key = scoreKey("offgrid", diff);
    const isRecord = total > getBest(key) && total > 0;
    if (isRecord) setBest(key, total);
    recordPlay("offgrid");
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
      if (phase === "pick") {
        const n = parseInt(event.key, 10);
        if (n >= 1 && n <= STEPS) { event.preventDefault(); judge(n - 1); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (phase === "menu") {
    return (
      <main className={`stage menuStage ${styles.stage}`}>
        <Stagger style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <Item>
            <div className={styles.menuMark} aria-hidden>
              {Array.from({ length: STEPS }, (_, i) => (
                <span key={i} className={i === 4 ? styles.menuNudged : ""} />
              ))}
            </div>
          </Item>
          <Item><h1 className="wordmark">Off-Grid</h1></Item>
          <Item><p className="tagline">Eight hits, and exactly one of them is late. Easy round one — but the nudge shrinks every round until it is almost nothing.</p></Item>
          <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <GameSetup game="offgrid" diffs={DIFFS} diff={diff} onDiff={setDiff} onStart={start} refreshToken={runStamp}
              helpContent={{
                title: "Off-Grid",
                description: "A producer's ear test: hear which hit drags behind the grid.",
                steps: [
                  "The eight-step loop plays three times; the steps light up as it goes.",
                  "One hit (never beat 1) lands late. Bind what you hear to the step numbers.",
                  "When the loop stops, tap the guilty step — or press its number — within six seconds.",
                  "Exact step scores 10, next door scores 3. Each of the five rounds shrinks the nudge.",
                ],
              }} />
          </Item>
        </Stagger>
      </main>
    );
  }

  if (phase === "results") {
    const total = results.reduce((sum, result) => sum + result.score, 0);
    const best = getBest(scoreKey("offgrid", diff));
    return (
      <main className={`stage ${styles.stage}`}>
        <Pop className={styles.feedback}>
          <h1 className="resVerdict">{verdict(total)}</h1>
          <div className={styles.score}>{total}<small> / 50</small></div>
          <div className="resTotal">best {best.toFixed(0)} · {results.filter((r) => r.score === 10).length}/{ROUNDS} nailed</div>
          {record && <div className="record">New best</div>}
          <div className="resActions">
            <button className="cta" data-note={523} onClick={start}>Again</button>
            <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Menu</button>
          </div>
        </Pop>
      </main>
    );
  }

  const showTruth = phase === "feedback" && current !== null;

  return (
    <main className={`stage ${styles.stage} ${styles.playStage}`}>
      <div className={styles.eyebrow}>
        {phase === "listen" ? `Pass ${pass + 1} of ${PASSES} · one hit is late` :
         phase === "pick" ? "Which hit was late?" :
         revealing ? "Hear it again — watch the flash" :
         current?.score === 10 ? "Caught it" : current?.score === 3 ? "Next door" : "Not that one"}
      </div>
      <div className={styles.roundTag}>Round {round + 1} of {ROUNDS} · nudge {Math.round(offset.current)}ms</div>
      <div className={styles.scene}>
        <div className={styles.lane} role={phase === "pick" ? "group" : undefined} aria-label="Steps">
          {Array.from({ length: STEPS }, (_, step) => {
            const isCulprit = showTruth && step === current.culprit;
            const isPicked = showTruth && step === current.picked && current.picked !== current.culprit;
            const lit = step === activeStep;
            const flash = lit && revealing && step === current?.culprit;
            return (
              <button
                key={step}
                className={[
                  styles.step,
                  lit ? styles.on : "",
                  flash ? styles.flash : "",
                  isCulprit ? styles.culprit : "",
                  isPicked ? styles.wrongPick : "",
                  phase === "pick" ? styles.pickable : "",
                ].join(" ")}
                disabled={phase !== "pick"}
                data-note={440 + step * 44}
                onClick={() => judge(step)}
                aria-label={`Step ${step + 1}`}
              >
                <i />
                <b>{step + 1}</b>
              </button>
            );
          })}
        </div>
        {phase === "pick" && (
          <div className={styles.countWrap} aria-hidden>
            <div key={round} className={styles.countBar} style={{ animationDuration: `${PICK_MS}ms` }} />
          </div>
        )}
        {showTruth && (
          <Pop className={styles.delta}>
            {current.score === 10 ? `Beat ${current.culprit + 1}` : `It was beat ${current.culprit + 1}`}
            <small>
              {Math.round(current.offset)}ms late
              {current.picked === null ? " · you ran out of time" :
               current.picked !== current.culprit ? ` · you said ${current.picked + 1}` : ""}
              {` · +${current.score}`}
            </small>
          </Pop>
        )}
      </div>
      {showTruth && (
        <div className={styles.nextRow}>
          <button className="cta" data-note={659} onClick={advance}>
            {round + 1 < ROUNDS ? "Next round" : "See results"}
          </button>
        </div>
      )}
      <div className={`hint ${styles.hint}`}>
        {phase === "listen" ? "Just listen · bind the drag to a number" :
         phase === "pick" ? "Tap a step or press 1–8" :
         "The flash lands exactly where the hit did"}
      </div>
    </main>
  );
}
