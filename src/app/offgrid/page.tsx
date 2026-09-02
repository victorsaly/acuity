"use client";

import { useEffect, useRef, useState } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import Leaderboard from "@/components/Leaderboard";
import { Item, Pop, Stagger } from "@/components/Fx";
import { audio, buzz, clap, hat, heardNow, kick, uiBlip } from "@/lib/audio";
import ShareScore from "@/components/ShareScore";
import { getBest, recordPlay, runRng, scoreKey, setBest, usePref, seededRng, dailySeed, dayNumber, todayStamp } from "@/lib/store";
import { postRun, signIn, useSignedIn } from "@/lib/arcade";
import { barEmoji } from "@/lib/share";
import styles from "./page.module.css";

type Phase = "menu" | "listen" | "pick" | "feedback" | "results" | "board";
/** Something to do at a point on the audio clock. */
type Cue = { at: number; run: () => void };
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
const DIFF_KEYS = DIFFS.map((d) => d.key);
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
  const [diff, setDiff] = usePref("offgrid-diff", "easy", DIFF_KEYS);
  const [round, setRound] = useState(0);
  const [pass, setPass] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);
  const [revealing, setRevealing] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [current, setCurrent] = useState<Result | null>(null);
  const [record, setRecord] = useState(false);
  /* Whether this run is today's shared challenge, and its seed. Only a seeded
     run can be rebuilt server-side, so only a seeded run can be ranked. */
  const [daily, setDaily] = usePref("beats-daily", "off", ["off", "on"]);
  const seedRef = useRef<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  /* Whether the finished run was the daily. State, not the ref: this is read
     while rendering the results, and a ref does not re-render. */
  const [rankedRun, setRankedRun] = useState(false);
  const signedIn = useSignedIn(phase);
  const [runStamp, setRunStamp] = useState(0);
  const cues = useRef<Cue[]>([]);
  const frame = useRef(0);
  const rng = useRef(runRng());
  const culprit = useRef(1);
  const offset = useRef(0);
  const settled = useRef(false);

  const clear = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    cues.current = [];
  };

  /**
   * Everything visible happens on the audio clock. This game asks you to spot a
   * hit that is 14ms late at the top difficulty, and the replay is supposed to
   * flash the culprit at its true late moment — a setTimeout light, which
   * drifts 5-20ms on its own, cannot show a 14ms nudge honestly.
   */
  const pump = () => {
    const t = heardNow();
    while (cues.current.length && t >= cues.current[0].at) cues.current.shift()!.run();
    frame.current = cues.current.length ? requestAnimationFrame(pump) : 0;
  };

  const schedule = (list: Cue[]) => {
    cues.current = [...cues.current, ...list].sort((a, b) => a.at - b.at);
    if (!frame.current) frame.current = requestAnimationFrame(pump);
  };

  useEffect(() => clear, []);

  const stepSeconds = () => 60 / CONFIG[diff].bpm / 2; // eighth notes

  /** One pass of the loop. Audio is scheduled now; the lights come back as cues
   *  on the same clock, so a lamp and the hit it belongs to cannot drift apart. */
  const schedulePass = (audioAt: number, nudged: boolean, reveal: boolean): Cue[] => {
    const stepSec = stepSeconds();
    const lights: Cue[] = [];
    for (let step = 0; step < STEPS; step++) {
      const late = nudged && step === culprit.current ? offset.current / 1000 : 0;
      const when = audioAt + step * stepSec + late;
      if (step === 0) kick(when, 0.9);
      if (step === 4) clap(when, 0.5);
      hat(when, false, step === 0 ? 0.42 : 0.3);
      /* Listening passes light the grid, not the nudge — a lamp sliding late
         would hand you the answer. The reveal lights the true late moment. */
      lights.push({ at: reveal ? when : audioAt + step * stepSec, run: () => setActiveStep(step) });
    }
    return lights;
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
    const passSec = passMs / 1000;
    const queue: Cue[] = [];
    for (let p = 0; p < PASSES; p++) {
      const at = audioStart + p * passSec;
      queue.push(...schedulePass(at, true, false), { at, run: () => setPass(p) });
    }
    const pickAt = audioStart + PASSES * passSec + 0.12;
    queue.push(
      { at: pickAt, run: () => { setActiveStep(-1); setPhase("pick"); } },
      { at: pickAt + PICK_MS / 1000, run: () => judge(null) },
    );
    schedule(queue);
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
    const replayAt = audio().currentTime + 0.75;
    schedule([
      { at: replayAt - 0.05, run: () => setRevealing(true) },
      ...schedulePass(replayAt, true, true),
      { at: replayAt + STEPS * stepSeconds() + 0.4, run: () => { setRevealing(false); setActiveStep(-1); } },
    ]);
  };

  const start = () => {
    const seed = daily === "on" ? dailySeed("offgrid") : null;
    seedRef.current = seed;
    setRankedRun(seedRef.current !== null);
    setRank(null);
    rng.current = seed === null ? runRng() : seededRng(seed);
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
      /* Put it on the shared board, if this was the daily. Not signed in
         holds the run for the sign-in rather than dropping it. Failure is
         silent either way: the score is already safe locally, and a
         leaderboard is never worth interrupting a game for. */
      {
        const seed = seedRef.current;
        if (seed !== null) {
          postRun({
            mode: `offgrid-${diff}`,
            period: todayStamp(),
            seed,
            score: Math.round(total * 10),
            proof: { picks: results.map((r) => r.picked) },
          })
            .then((posted) => setRank(posted?.rank ?? null))
            .catch(() => {});
        }
      }
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

  if (phase === "board") {
    return (
      <main className="stage menuStage">
        <Leaderboard mode={`offgrid-${diff}`} title="Off-Grid"
          metric="Microtiming" unit="/ 50"
          onClose={() => setPhase("menu")} />
      </main>
    );
  }

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
          <Item><p className="tagline">Eight hits and exactly one of them drags. Round one is easy. By round five the delay is a few milliseconds and you start doubting yourself.</p></Item>
          <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <GameSetup game="offgrid"
              daily={daily === "on"}
              onDaily={(on) => setDaily(on ? "on" : "off")}
              dayNumber={dayNumber()} diffs={DIFFS} diff={diff} onDiff={setDiff} onStart={start} refreshToken={runStamp} formatBest={(b) => `${b} / 50`}
              helpContent={{
                title: "Off-Grid",
                description: "An eight-step drum loop with one hit sitting slightly behind the grid. Which one?",
                steps: [
                  "The loop plays three times and the steps light up as it goes.",
                  "One hit is late. Never step 1, so that's one guess you can skip.",
                  "When it stops you get six seconds: tap the step, or press its number.",
                  "Dead on scores 10, one either side scores 3. Five rounds, each one tighter.",
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
      <main className={`stage resScrim ${styles.stage}`}>
        <Pop className={styles.feedback}>
          <h1 className="resVerdict">{verdict(total)}</h1>
          <div className={styles.score}>{total}<small> / 50</small></div>
          <div className="resTotal">best {best.toFixed(0)} · {results.filter((r) => r.score === 10).length}/{ROUNDS} nailed</div>
          {record && <div className="record">New best</div>}
          <div className="resActions">
            <button className="cta" data-note={523} onClick={start}>Again</button>
            <ShareScore
              game="Off-Grid"
              route="offgrid"
              detail={diff}
              line={`${total} / 50 ${barEmoji(total * 2)} · ${results.filter((r) => r.score === 10).length}/${ROUNDS} nailed`}
              level={diff}
            />
        {/* Where this run landed, or the offer to put it there. Only ever for
            the daily, which is the only ranked run. */}
        {rank !== null ? (
          <p className="rankLine">
            <b>#{rank}</b> on today&rsquo;s Off-Grid board{" "}
            <button className="linkish" onClick={() => setPhase("board")}>See the board</button>
          </p>
        ) : rankedRun && !signedIn ? (
          <button className="ghost" data-note={523} onClick={() => signIn()}>
            Put this score on the daily board
          </button>
        ) : null}
            <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Menu</button>
          </div>
        </Pop>
      </main>
    );
  }

  /* the nudge is a pure function of the round — derive it rather than reading
     the scheduler's ref during render (React doesn't track ref reads) */
  const nudgeMs = Math.round(
    CONFIG[diff].startMs + ((CONFIG[diff].endMs - CONFIG[diff].startMs) * round) / (ROUNDS - 1));
  const showTruth = phase === "feedback" && current !== null;

  return (
    <main className={`stage ${styles.stage} ${styles.playStage}`}>
      <div className={styles.eyebrow}>
        {phase === "listen" ? `Pass ${pass + 1} of ${PASSES} · one hit is late` :
         phase === "pick" ? "Which hit was late?" :
         revealing ? "Hear it again — watch the flash" :
         current?.score === 10 ? "Caught it" : current?.score === 3 ? "Next door" : "Not that one"}
      </div>
      <div className={styles.roundTag}>Round {round + 1} of {ROUNDS} · nudge {nudgeMs}ms</div>
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
