"use client";

import { useEffect, useRef, useState } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import { Pop, Stagger, Item } from "@/components/Fx";
import { audio, click, hat, kick, snare } from "@/lib/audio";
import { getBest, recordPlay, scoreKey, setBest, usePref } from "@/lib/store";
import styles from "./page.module.css";

type Phase = "menu" | "watch" | "alarm" | "play" | "results";
type Judgement = { slot: number; score: number; label: string };

const WATCH_BEATS = 4;
const PLAY_START_BEAT = WATCH_BEATS + 1;
const PLAY_BEATS = 8;
const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "92 BPM · forgiving", note: 523 },
  { key: "hard", label: "Hard", sub: "116 BPM · tighter", note: 659 },
  { key: "brutal", label: "Brutal", sub: "142 BPM · possessed", note: 784 },
];
const CONFIG: Record<string, { bpm: number; window: number }> = {
  easy: { bpm: 92, window: 190 },
  hard: { bpm: 116, window: 145 },
  brutal: { bpm: 142, window: 105 },
};

const verdict = (score: number) =>
  score >= 72 ? "Microwave whisperer." :
  score >= 58 ? "Breakfast obeys you." :
  score >= 38 ? "Kitchen unstable." : "The appliance won.";

export default function FeverGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = usePref("fever-diff", "easy");
  const [pulse, setPulse] = useState(0);
  const [activeBeat, setActiveBeat] = useState(-1);
  const [judgements, setJudgements] = useState<Judgement[]>([]);
  const [feedback, setFeedback] = useState("");
  const [finalScore, setFinalScore] = useState(0);
  const [record, setRecord] = useState(false);
  const [runStamp, setRunStamp] = useState(0);
  const timers = useRef<number[]>([]);
  const playStartsAt = useRef(0);
  const hits = useRef<Map<number, Judgement>>(new Map());

  const clear = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  };

  useEffect(() => clear, []);

  const finish = (difficulty: string) => {
    const complete = Array.from({ length: PLAY_BEATS }, (_, slot) =>
      hits.current.get(slot) ?? { slot, score: 0, label: "Miss" });
    const total = complete.reduce((sum, hit) => sum + hit.score, 0);
    const rounded = Math.round(total * 10) / 10;
    const key = scoreKey("fever", difficulty);
    const isRecord = rounded > getBest(key) && rounded > 0;
    if (isRecord) setBest(key, rounded);
    recordPlay("fever");
    setJudgements(complete);
    setFinalScore(rounded);
    setRecord(isRecord);
    setRunStamp((value) => value + 1);
    setPhase("results");
  };

  const start = () => {
    clear();
    audio();
    const difficulty = diff;
    const { bpm, window: timingWindow } = CONFIG[difficulty];
    const beatMs = 60000 / bpm;
    const beginsAt = performance.now() + 650;
    playStartsAt.current = beginsAt + PLAY_START_BEAT * beatMs;
    hits.current = new Map();
    setJudgements([]);
    setFeedback("");
    setRecord(false);
    setActiveBeat(-1);
    setPhase("watch");

    for (let index = 0; index < PLAY_START_BEAT + PLAY_BEATS; index++) {
      const timer = window.setTimeout(() => {
        const context = audio();
        if (index === WATCH_BEATS) {
          click(context.currentTime, true, 1760);
          click(context.currentTime + 0.12, true, 2093);
          setPulse((value) => value + 1);
          setActiveBeat(index);
          setPhase("alarm");
          return;
        }
        kick(context.currentTime, index % 4 === 0 ? 0.95 : 0.72);
        if (index % 4 === 2) snare(context.currentTime, 0.55);
        hat(context.currentTime, false, 0.34);
        setPulse((value) => value + 1);
        setActiveBeat(index);
        if (index === PLAY_START_BEAT) setPhase("play");
      }, Math.max(0, beginsAt + index * beatMs - performance.now()));
      timers.current.push(timer);
    }

    const endTimer = window.setTimeout(
      () => finish(difficulty),
      Math.max(0, playStartsAt.current + PLAY_BEATS * beatMs + timingWindow - performance.now()),
    );
    timers.current.push(endTimer);
  };

  const tap = () => {
    if (phase !== "play") return;
    const { bpm, window: timingWindow } = CONFIG[diff];
    const beatMs = 60000 / bpm;
    const slot = Math.round((performance.now() - playStartsAt.current) / beatMs);
    if (slot < 0 || slot >= PLAY_BEATS || hits.current.has(slot)) return;
    const target = playStartsAt.current + slot * beatMs;
    const error = Math.abs(performance.now() - target);
    const score = Math.max(0, 10 * (1 - error / timingWindow));
    const label = score >= 8 ? "Delicious" : score >= 4 ? "Edible" : "Burnt";
    const judgement = { slot, score, label };
    hits.current.set(slot, judgement);
    setJudgements(Array.from(hits.current.values()));
    setFeedback(label);
    snare(audio().currentTime, 0.42);
    const timer = window.setTimeout(() => setFeedback(""), 330);
    timers.current.push(timer);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase !== "menu" && !document.fullscreenElement) {
        event.preventDefault();
        clear();
        setPhase("menu");
        return;
      }
      if ((event.key === " " || event.key === "Enter") && phase === "play" && !event.repeat) {
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
          <Item><div className={styles.menuMark} aria-hidden /></Item>
          <Item><h1 className="wordmark">Fever Dream</h1></Item>
          <Item><p className="tagline">The microwave is keeping time and breakfast wants out. Watch how it moves, then feed it eight taps without a timing lane.</p></Item>
          <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <GameSetup game="fever" diffs={DIFFS} diff={diff} onDiff={setDiff} onStart={start} refreshToken={runStamp}
              helpContent={{
                title: "Fever Dream",
                description: "Read the appliance's movement like a drummer's count-in, then keep the same pulse yourself.",
                steps: [
                  "Watch four beats as the microwave squashes and its door kicks open.",
                  "A two-tone alarm gives you one full beat to get ready.",
                  "When TAP appears, tap anywhere or press Space on each pulse.",
                  "Eight taps are judged by timing; missed beats score zero.",
                ],
              }} />
          </Item>
        </Stagger>
      </main>
    );
  }

  if (phase === "results") {
    const best = getBest(scoreKey("fever", diff));
    return (
      <main className={`stage ${styles.stage}`}>
        <Pop className={styles.results}>
          <h1 className="resVerdict">{verdict(finalScore)}</h1>
          <div className={styles.score}>{finalScore.toFixed(1)}<small> / 80</small></div>
          <div className="resTotal">best {best.toFixed(1)} · {judgements.filter((hit) => hit.score > 0).length}/{PLAY_BEATS} fed</div>
          {record && <div className="record">New best</div>}
          <div className="resActions">
            <button className="cta" data-note={523} onClick={start}>Dream again</button>
            <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Wake up</button>
          </div>
        </Pop>
      </main>
    );
  }

  return (
    <main className={`stage ${styles.stage} ${styles.playStage}`} onPointerDown={tap}>
      <div className={styles.eyebrow}>
        {phase === "watch" ? "Watch the microwave" : phase === "alarm" ? "Alarm · tapping starts next beat" : "Feed it the beat"}
      </div>
      <div key={pulse} className={`${styles.scene} ${styles.hit} ${phase === "alarm" ? styles.alarm : ""}`} aria-hidden>
        <div className={styles.appliance}>
          <div className={styles.door}><div className={styles.thing} /></div>
          <div className={styles.controls}>
            <div className={styles.display}>{phase === "watch" ? "LOOK" : phase === "alarm" ? "!!" : "TAP"}</div>
            <div className={styles.knob} />
            <div className={styles.knob} />
          </div>
        </div>
      </div>
      {phase === "play" && (
        <div className={styles.progress} aria-label={`${judgements.length} of ${PLAY_BEATS} beats hit`}>
          {Array.from({ length: PLAY_BEATS }, (_, slot) => {
            const hit = judgements.find((item) => item.slot === slot);
            const passed = activeBeat >= PLAY_START_BEAT + slot;
            return <span key={slot} className={hit ? styles.done : passed ? styles.miss : ""} />;
          })}
        </div>
      )}
      {feedback && <div key={`${feedback}-${judgements.length}`} className={styles.feedback}>{feedback}</div>}
      <div className={`hint ${styles.hint}`}>
        {phase === "watch" ? "Four beats · movement is the count-in" : phase === "alarm" ? "Get ready · tapping starts next beat" : "Tap anywhere or press Space"}
      </div>
    </main>
  );
}