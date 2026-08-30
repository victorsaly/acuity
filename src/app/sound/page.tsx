"use client";

import { useEffect, useRef, useState } from "react";
import GameSetup, { type DiffDef } from "@/components/GameSetup";
import ShareScore from "@/components/ShareScore";
import { Stagger, Item, Pop } from "@/components/Fx";
import { audio, toneOn, toneGlide, toneOff, playTone, setToneVoice, type ToneVoice } from "@/lib/audio";
import { getBest, setBest, scoreKey, rngFor, usePref, todayStamp, type Mode } from "@/lib/store";
import { scoreCard, slotEmoji } from "@/lib/share";

type Phase = "menu" | "reveal" | "recall" | "results";

const SLOTS = 5;
const F_LO = 110, OCTAVES = 3; // 110–880 Hz
const DIFFS: DiffDef[] = [
  { key: "easy", label: "Easy", sub: "3s each", note: 523 },
  { key: "hard", label: "Hard", sub: "1.5s each", note: 659 },
  { key: "brutal", label: "Brutal", sub: "0.7s each", note: 784 },
];
const REVEAL_MS: Record<string, number> = { easy: 3000, hard: 1500, brutal: 700 };
const VOICES = [
  { key: "warm", label: "Warm" },
  { key: "pure", label: "Pure" },
  { key: "organ", label: "Organ" },
  { key: "chip", label: "Chip" },
];

const posToFreq = (p: number) => F_LO * Math.pow(2, (p / 1000) * OCTAVES);
const cents = (a: number, b: number) => Math.abs(1200 * Math.log2(a / b));
const scoreOf = (t: number, g: number) => Math.max(0, 10 * (1 - cents(t, g) / 300));
/* monochrome pitch cue: low = dim grey, high = bright white */
const lightOf = (f: number) => 45 + (Math.log2(f / F_LO) / OCTAVES) * 50;
const colorOf = (f: number) => `hsl(0 0% ${lightOf(f)}%)`;
const resVerdict = (total: number) =>
  total >= 45 ? "Perfect pitch." :
  total >= 38 ? "Well tuned." :
  total >= 28 ? "Close enough for jazz." :
  total >= 18 ? "A little flat." : "Ears need a reboot.";

export default function SoundGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = usePref("sound-diff", "easy");
  const [modeStr, setMode] = usePref("sound-mode", "free");
  const mode = modeStr as Mode;
  const [slot, setSlot] = useState(0);
  const [targets, setTargets] = useState<number[]>([]);
  const [guesses, setGuesses] = useState<number[]>([]);
  const [pos, setPos] = useState(500);
  const [voiceStr, setVoice] = usePref("sound-voice", "warm");
  const voice = voiceStr as ToneVoice;
  const [revealOn, setRevealOn] = useState(false);
  const [runStamp, setRunStamp] = useState(0);

  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => { clear(); toneOff(); }, []);

  /* ---------- full-screen waveform ---------- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wave = useRef({ liveFreq: 220, drawFreq: 220, amp: 0, targetAmp: 0, phase: 0, last: 0 });

  useEffect(() => {
    const cv = canvasRef.current!;
    const g2 = cv.getContext("2d")!;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      cv.width = innerWidth * devicePixelRatio;
      cv.height = innerHeight * devicePixelRatio;
    };
    resize();
    addEventListener("resize", resize);
    let raf = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      const w = wave.current;
      const dt = Math.min(0.05, (t - w.last) / 1000 || 0.016);
      w.last = t;
      const W = cv.width, H = cv.height, mid = H / 2;
      w.amp += (w.targetAmp - w.amp) * (1 - Math.exp(-dt * 10));
      w.drawFreq += (w.liveFreq - w.drawFreq) * (1 - Math.exp(-dt * 14));
      if (!reduceMotion) w.phase += dt * w.drawFreq * 0.055;
      g2.clearRect(0, 0, W, H);
      if (w.amp < 0.004) return;
      const cycles = 1.5 + (Math.log2(w.drawFreq / F_LO) / OCTAVES) * 9;
      const amp = w.amp * H * 0.16;
      const L = lightOf(w.drawFreq);
      const N = 140;
      for (let layer = 2; layer >= 0; layer--) {
        g2.beginPath();
        for (let i = 0; i <= N; i++) {
          const x = (i / N) * W;
          const env = Math.sin((i / N) * Math.PI);
          const y = mid + Math.sin((i / N) * cycles * 2 * Math.PI - w.phase) * amp * env;
          if (i) g2.lineTo(x, y); else g2.moveTo(x, y);
        }
        if (layer === 2) { g2.strokeStyle = `hsla(0 0% ${L}% / ${0.1 * w.amp})`; g2.lineWidth = 26 * devicePixelRatio; }
        if (layer === 1) { g2.strokeStyle = `hsla(0 0% ${L}% / ${0.35 * w.amp})`; g2.lineWidth = 8 * devicePixelRatio; }
        if (layer === 0) { g2.strokeStyle = `hsla(0 0% ${Math.min(98, L + 20)}% / ${0.95 * w.amp})`; g2.lineWidth = 2.5 * devicePixelRatio; }
        g2.lineCap = "round";
        g2.stroke();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, []);

  const hear = (f: number) => { wave.current.liveFreq = f; wave.current.targetAmp = 1; toneOn(f); };
  const hush = () => { wave.current.targetAmp = 0; toneOff(); };

  /* ---------- flow ---------- */
  function revealSlot(i: number, tones: number[], ms: number) {
    setSlot(i);
    setRevealOn(true);
    hear(tones[i]);
    later(() => {
      hush();
      setRevealOn(false);
      later(() => {
        if (i + 1 < SLOTS) revealSlot(i + 1, tones, ms);
        else { setSlot(0); setPos(500); setPhase("recall"); }
      }, 260);
    }, ms);
  }

  const start = () => {
    clear();
    audio();
    setToneVoice(voice);   // remembered preference may not have touched the engine yet
    const rng = rngFor(mode, "sound", diff);
    const tones = Array.from({ length: SLOTS }, () => posToFreq(40 + rng() * 920));
    setTargets(tones);
    setGuesses([]);
    setPhase("reveal");
    revealSlot(0, tones, REVEAL_MS[diff]);
  };

  const lock = () => {
    hush();
    const next = [...guesses, posToFreq(pos)];
    setGuesses(next);
    if (next.length < SLOTS) {
      setSlot(next.length);
      setPos(500);
    } else {
      const total = targets.reduce((sum, t, i) => sum + scoreOf(t, next[i]), 0);
      const key = scoreKey("sound", mode, diff);
      if (total > getBest(key)) setBest(key, Math.round(total * 10) / 10);
      setRunStamp(Date.now());
      setPhase("results");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && phase === "recall") lock();
      if (e.key === "Escape" && phase !== "menu" && !document.fullscreenElement) { clear(); hush(); setPhase("menu"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  /* draw mini waveforms on the results tiles */
  const panelsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase !== "results" || !panelsRef.current) return;
    panelsRef.current.querySelectorAll<HTMLElement>(".soundHalf").forEach((h) => {
      const f = Number(h.dataset.f);
      const cv = h.querySelector("canvas")!;
      const c = cv.getContext("2d")!;
      const W = (cv.width = (cv.offsetWidth || 100) * devicePixelRatio);
      const H = (cv.height = (cv.offsetHeight || 30) * devicePixelRatio);
      const cyc = 1.5 + (Math.log2(f / F_LO) / OCTAVES) * 9;
      c.beginPath();
      for (let i = 0; i <= 80; i++) {
        const x = (i / 80) * W;
        const y = H / 2 + Math.sin((i / 80) * cyc * 2 * Math.PI) * H * 0.36;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.strokeStyle = colorOf(f);
      c.lineWidth = 2 * devicePixelRatio;
      c.lineCap = "round";
      c.stroke();
    });
  }, [phase]);

  const guessFreq = posToFreq(pos);

  const tapTone = (f: number) => {
    wave.current.liveFreq = f;
    wave.current.targetAmp = 1;
    playTone(f, 700);
    window.setTimeout(() => { wave.current.targetAmp = 0; }, 700);
  };

  const resScores = phase === "results" ? targets.map((t, i) => scoreOf(t, guesses[i])) : [];
  const resTotal = resScores.reduce((a, b) => a + b, 0);
  const resBest = phase === "results" ? getBest(scoreKey("sound", mode, diff)) : 0;

  return (
    <>
      <canvas ref={canvasRef} className="fullCanvas" aria-hidden />

      {phase === "menu" && (
        <main className="stage">
          <Stagger style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <Item><h1 className="wordmark">Sine Language</h1></Item>
            <Item><p className="tagline">Five tones, one each. Then silence — and you pull every pitch back out of thin air.</p></Item>
            <Item style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <GameSetup game="sound" diffs={DIFFS} diff={diff} mode={mode}
                onDiff={setDiff} onMode={setMode} onStart={start} refreshToken={runStamp}
                sounds={VOICES} sound={voice}
                onSound={(k) => {
                  const v = k as ToneVoice;
                  setVoice(v);
                  setToneVoice(v);
                  audio();
                  tapTone(330);      // hear the new voice right away
                }} />
            </Item>
          </Stagger>
          <div className="hint">Sound on · headphones recommended</div>
        </main>
      )}

      {phase === "reveal" && (
        <main className="stage">
          <div className="slotTag" style={{ color: "var(--muted)" }}>Listen</div>
          <div className="slotNum" style={{ color: revealOn ? colorOf(targets[slot]) : "transparent", textShadow: "0 0 60px rgba(0,0,0,.55)" }}>
            {slot + 1}
          </div>
        </main>
      )}

      {phase === "recall" && (
        <main className="stage recallStage">
          <div className="recallHead" style={{ color: "var(--muted)" }}>
            Rebuild tone {guesses.length + 1} of {SLOTS}
          </div>
          <div className="hz" style={{ color: colorOf(guessFreq) }}>
            {Math.round(guessFreq)}<small>Hz</small>
          </div>
          <div className="mixer">
            <input type="range" className="freqSlider" min={0} max={1000} step={1} value={pos}
              aria-label="Frequency"
              onChange={(e) => { const p = +e.target.value; setPos(p); toneGlide(posToFreq(p)); wave.current.liveFreq = posToFreq(p); }}
              onPointerDown={() => hear(posToFreq(pos))}
              onPointerUp={hush}
              onKeyDown={(e) => {
                if (e.key.startsWith("Arrow")) {
                  hear(posToFreq(pos));
                  window.clearTimeout((wave.current as unknown as { kt?: number }).kt);
                  (wave.current as unknown as { kt?: number }).kt = window.setTimeout(hush, 350);
                }
              }} />
            <div className="rangeTags"><span>110 Hz · Low</span><span>880 Hz · High</span></div>
            <button className="lock" data-note={440} onClick={lock}>Lock it in</button>
            <div className="kbd" style={{ marginTop: 12 }}>
              <span><b>←→</b>fine tune</span><span><b>↵</b>lock</span><span><b>Esc</b>menu</span>
            </div>
          </div>
        </main>
      )}

      {phase === "results" && (
        <main className="stage resStage">
          <Pop className="resHead">
            <h2 className="resVerdict">{resVerdict(resTotal)}</h2>
            <div className="resTotal">
              <b>{resTotal.toFixed(1)} / 50</b> · {mode} · {diff}
              {resBest > 0 && ` · best ${resBest.toFixed(1)}`}
            </div>
          </Pop>
          <Stagger className="soundPanels">
            <div ref={panelsRef} style={{ display: "contents" }}>
            {targets.map((t, i) => {
              const g = guesses[i];
              const off = Math.round(1200 * Math.log2(g / t));
              return (
                <Item className="soundPanel" key={i}>
                  <button className="soundHalf" data-f={t} data-silent=""
                    aria-label={`Play target tone ${i + 1}`}
                    onPointerEnter={() => hear(t)} onPointerLeave={hush}
                    onClick={() => tapTone(t)}>
                    <canvas /><span className="val">{Math.round(t)} Hz</span><span className="tag">target</span>
                  </button>
                  <div className="seam">
                    {resScores[i].toFixed(2)} <small>{off === 0 ? "exact" : `${off > 0 ? "+" : ""}${off}¢`}</small>
                  </div>
                  <button className="soundHalf" data-f={g} data-silent=""
                    aria-label={`Play your tone ${i + 1}`}
                    onPointerEnter={() => hear(g)} onPointerLeave={hush}
                    onClick={() => tapTone(g)}>
                    <canvas /><span className="val">{Math.round(g)} Hz</span><span className="tag">you</span>
                  </button>
                </Item>
              );
            })}
            </div>
          </Stagger>
          <div className="resActions">
            <button className="cta" data-note={440} onClick={start}>Play again</button>
            <ShareScore text={scoreCard(
              "Sine Language",
              `${diff}${mode === "daily" ? ` · daily ${todayStamp()}` : ""}`,
              `${resTotal.toFixed(1)}/50 ${resScores.map(slotEmoji).join("")}`,
            )} />
            <button className="ghost" data-note={349} onClick={() => setPhase("menu")}>Options</button>
          </div>
        </main>
      )}
    </>
  );
}
