"use client";

import { useEffect, useRef, useState } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import { Pop, Stagger, Item } from "@/components/Fx";
import { audio, click, hat, heardNow, kick, snare } from "@/lib/audio";
import { getBest, recordPlay, scoreKey, setBest, usePref } from "@/lib/store";
import styles from "./page.module.css";

type Phase = "menu" | "watch" | "alarm" | "play" | "results";
type Judgement = { slot: number; score: number; label: string };

/** Two bars of groove, the alarm on the beat after them, then you, alone. */
const COUNT_BEATS = 8;
const ALARM_BEAT = COUNT_BEATS;
const PLAY_START_BEAT = ALARM_BEAT + 1;
const PLAY_BEATS = 8;
const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "92 BPM · forgiving", note: 523 },
  { key: "hard", label: "Hard", sub: "116 BPM · tighter", note: 659 },
  { key: "brutal", label: "Brutal", sub: "142 BPM · possessed", note: 784 },
];
const DIFF_KEYS = DIFFS.map((d) => d.key);
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
  const [diff, setDiff] = usePref("fever-diff", "easy", DIFF_KEYS);
  const [pulse, setPulse] = useState(0);
  const [judgements, setJudgements] = useState<Judgement[]>([]);
  const [feedback, setFeedback] = useState("");
  const [finalScore, setFinalScore] = useState(0);
  const [record, setRecord] = useState(false);
  const [runStamp, setRunStamp] = useState(0);
  const frame = useRef(0);
  const fadeTimer = useRef(0);
  const lastBeat = useRef(-1);
  const done = useRef(false);
  const phaseRef = useRef<Phase>("menu");
  const hits = useRef<Map<number, Judgement>>(new Map());
  /* Count-in, alarm and every scoring slot are points on the audio clock. The
     count-in is scheduled against it up front, so what you hear is sample
     accurate, and taps are read off the same clock — setTimeout jitter alone
     used to eat a chunk of the brutal window. */
  const plan = useRef({ beat: 0, startCtx: 0, playStartCtx: 0, endCtx: 0, window: 0 });

  const stop = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    frame.current = 0;
    fadeTimer.current = 0;
  };

  const goPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => stop, []);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    stop();
    const complete = Array.from({ length: PLAY_BEATS }, (_, slot) =>
      hits.current.get(slot) ?? { slot, score: 0, label: "Miss" });
    const total = complete.reduce((sum, hit) => sum + hit.score, 0);
    const rounded = Math.round(total * 10) / 10;
    const key = scoreKey("fever", diff);
    const isRecord = rounded > getBest(key) && rounded > 0;
    if (isRecord) setBest(key, rounded);
    recordPlay("fever");
    setJudgements(complete);
    setFinalScore(rounded);
    setRecord(isRecord);
    setRunStamp((value) => value + 1);
    goPhase("results");
  };

  const start = () => {
    stop();
    const { bpm, window: timingWindow } = CONFIG[diff];
    const beat = 60 / bpm;
    const context = audio();
    const startCtx = context.currentTime + 0.7;
    const playStartCtx = startCtx + PLAY_START_BEAT * beat;
    plan.current = {
      beat,
      startCtx,
      playStartCtx,
      /* Past the halfway point after the last slot a tap would round to slot 8
         and be thrown away, so there is nothing left to wait for. */
      endCtx: playStartCtx + (PLAY_BEATS - 0.5) * beat + 0.15,
      window: timingWindow,
    };
    hits.current = new Map();
    done.current = false;
    lastBeat.current = -1;
    setJudgements([]);
    setFeedback("");
    setRecord(false);
    setPulse((value) => value + 1);
    goPhase("watch");

    for (let index = 0; index < COUNT_BEATS; index++) {
      const when = startCtx + index * beat;
      kick(when, index % 4 === 0 ? 0.95 : 0.72);
      if (index % 4 === 2) snare(when, 0.55);
      hat(when, false, 0.34);
    }
    /* The alarm sits on the grid so the pulse runs unbroken right up to the
       moment you inherit it. */
    const alarmAt = startCtx + ALARM_BEAT * beat;
    click(alarmAt, true, 1760);
    click(alarmAt + 0.12, true, 2093);

    /* Nothing is scheduled from the first scoring slot onward. The premise is
       that the microwave stops and you carry the pulse; a click track running
       underneath made it a game of tapping along to an audible beat. */
    const tick = () => {
      const t = heardNow();
      const p = plan.current;
      const index = Math.floor((t - p.startCtx) / p.beat);
      if (index >= 0 && index <= ALARM_BEAT && index !== lastBeat.current) {
        lastBeat.current = index;
        setPulse((value) => value + 1);
        if (index === ALARM_BEAT) goPhase("alarm");
      }
      if (t >= p.playStartCtx && phaseRef.current !== "play") goPhase("play");
      if (t >= p.endCtx) {
        finish();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const tap = () => {
    if (phaseRef.current !== "play") return;
    const p = plan.current;
    const t = heardNow();
    const slot = Math.round((t - p.playStartCtx) / p.beat);
    if (slot < 0 || slot >= PLAY_BEATS || hits.current.has(slot)) return;
    const target = p.playStartCtx + slot * p.beat;
    const error = Math.abs(t - target) * 1000;
    const score = Math.max(0, 10 * (1 - error / p.window));
    const label = score >= 8 ? "Delicious" : score >= 4 ? "Edible" : "Burnt";
    hits.current.set(slot, { slot, score, label });
    setJudgements(Array.from(hits.current.values()));
    setFeedback(label);
    /* Your tap is the only sound in the room now — it plays the beat back at
       you, and a clean hit gets the hat on top. */
    const context = audio();
    kick(context.currentTime, 0.9);
    if (score >= 8) hat(context.currentTime, false, 0.4);
    setPulse((value) => value + 1);
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    fadeTimer.current = window.setTimeout(() => setFeedback(""), 330);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase !== "menu" && !document.fullscreenElement) {
        event.preventDefault();
        stop();
        done.current = true;
        goPhase("menu");
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
          <Item><p className="tagline">The microwave keeps time for two bars, then quits on you. Breakfast still wants out, so you hold the pulse alone. No lane, no arrows, no click track.</p></Item>
          <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <GameSetup game="fever" diffs={DIFFS} diff={diff} onDiff={setDiff} onStart={start} refreshToken={runStamp}
              helpContent={{
                title: "Fever Dream",
                description: "The microwave counts you in like a drummer. Then it stops dead and you carry the pulse on your own.",
                steps: [
                  "Two bars of groove: the microwave squashes and the door kicks open on every beat.",
                  "A two-tone alarm lands on the next beat — that is your handover.",
                  "Then everything goes silent. Tap anywhere (or Space) on all eight beats that follow.",
                  "Only your own taps make a sound. Beats you skip score nothing.",
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
          <div className={styles.tally} aria-hidden>
            {judgements.map((hit) => (
              <span key={hit.slot} className={hit.score > 0 ? styles.done : styles.miss} />
            ))}
          </div>
          <div className="resTotal">best {best.toFixed(1)} · {judgements.filter((hit) => hit.score > 0).length}/{PLAY_BEATS} fed</div>
          {record && <div className="record">New best</div>}
          <div className="resActions">
            <button className="cta" data-note={523} onClick={start}>Dream again</button>
            <button className="ghost" data-note={349} onClick={() => goPhase("menu")}>Wake up</button>
          </div>
        </Pop>
      </main>
    );
  }

  const fedSlots = new Set(judgements.map((hit) => hit.slot));

  return (
    <main className={`stage ${styles.stage} ${styles.playStage}`} onPointerDown={tap}>
      <div className={styles.eyebrow}>
        {phase === "watch" ? "Watch the microwave · two bars"
          : phase === "alarm" ? "Alarm · you take over next beat"
          : "Silence · you keep the pulse"}
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
        /* Fed beats only. Marking a miss the instant its slot passes would be a
           metronome by another name. */
        <div className={styles.progress} aria-label={`${judgements.length} of ${PLAY_BEATS} beats fed`}>
          {Array.from({ length: PLAY_BEATS }, (_, slot) => (
            <span key={slot} className={fedSlots.has(slot) ? styles.done : ""} />
          ))}
        </div>
      )}
      {feedback && <div key={`${feedback}-${judgements.length}`} className={styles.feedback}>{feedback}</div>}
      <div className={`hint ${styles.hint}`}>
        {phase === "watch" ? "Two bars · movement is the count-in"
          : phase === "alarm" ? "Get ready · tapping starts next beat"
          : "Tap anywhere or press Space · nothing will guide you"}
      </div>
    </main>
  );
}
