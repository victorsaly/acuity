"use client";

import { useEffect, useRef } from "react";
import { uiBlip } from "@/lib/audio";

/**
 * New-best celebration: a burst of confetti squares from the top of
 * the screen in the app's beat colors, plus a rising three-note
 * fanfare. Mount it and it plays once, then removes itself.
 */
const COLORS = ["#ffffff", "#3dc9ff", "#ff5f9e", "#ffb454", "#a4ff4f"];

export default function Celebrate() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext("2d")!;
    const DPR = Math.min(devicePixelRatio || 1, 2);
    const W = (cv.width = innerWidth * DPR), H = (cv.height = innerHeight * DPR);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    [523, 659, 784].forEach((f, i) => setTimeout(() => uiBlip(f, 0.06, 0.16), i * 110));
    if (reduce) return;

    const ps = Array.from({ length: 160 }, () => ({
      x: W * (0.2 + Math.random() * 0.6),
      y: -20 * DPR,
      vx: (Math.random() - 0.5) * 9 * DPR,
      vy: (2 + Math.random() * 7) * DPR,
      s: (5 + Math.random() * 7) * DPR,
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.3,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const life = (t - t0) / 2200;
      if (life > 1) { g.clearRect(0, 0, W, H); return; }
      raf = requestAnimationFrame(step);
      g.clearRect(0, 0, W, H);
      g.globalAlpha = life < 0.7 ? 1 : 1 - (life - 0.7) / 0.3;
      for (const p of ps) {
        p.vy += 0.18 * DPR;
        p.vx *= 0.99;
        p.x += p.vx; p.y += p.vy; p.a += p.va;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.a);
        g.fillStyle = p.c;
        g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      }
      g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 30, pointerEvents: "none" }}
    />
  );
}
