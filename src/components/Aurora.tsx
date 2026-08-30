"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Living background with four looks — a different one greets you on
 * every refresh, and B cycles them by hand:
 *   flow   – motes drifting along an evolving current (trails)
 *   orbits – a slow galaxy circling the screen center (trails)
 *   grid   – a dot lattice with waves of light passing through
 *   net    – a constellation that links up and shies from the cursor
 * Monochrome, one canvas, cheap. Opaque game phases cover it.
 */

const MODES = ["flow", "orbits", "grid", "net"] as const;
type Mode = (typeof MODES)[number];

export default function Aurora() {
  const [mode, setMode] = useState<Mode>(() => MODES[Math.floor(Math.random() * MODES.length)]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.key === "b" || e.key === "B") {
        setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext("2d")!;
    const DPR = Math.min(devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const resize = () => {
      W = cv.width = innerWidth * DPR;
      H = cv.height = innerHeight * DPR;
      g.fillStyle = "#0c0d12";
      g.fillRect(0, 0, W, H);
    };
    resize();
    addEventListener("resize", resize);

    const mouse = { x: -1e4, y: -1e4 };
    const onMove = (e: PointerEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onLeave = () => { mouse.x = -1e4; mouse.y = -1e4; };
    addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, t = 0;

    /* per-mode state */
    const flowPs = Array.from({ length: 240 }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight, vx: 0, vy: 0,
    }));
    const orbitPs = Array.from({ length: 130 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 40 + Math.random() * Math.max(innerWidth, innerHeight) * 0.55,
      sp: (0.02 + Math.random() * 0.12) * (Math.random() < 0.5 ? 1 : -1),
      s: 0.8 + Math.random() * 1.2,
    }));
    const netPs = Array.from({ length: 90 }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
    }));

    const step = () => {
      raf = requestAnimationFrame(step);
      t += 0.0045;

      if (mode === "flow" || mode === "orbits") {
        g.fillStyle = "rgba(12,13,18,0.085)";           // trail fade
        g.fillRect(0, 0, W, H);
      } else {
        g.fillStyle = "#0c0d12";                         // hard clear
        g.fillRect(0, 0, W, H);
      }

      if (mode === "flow") {
        for (const p of flowPs) {
          const a =
            Math.sin(p.x * 0.0021 + t * 2.6) +
            Math.cos(p.y * 0.0024 - t * 1.9) +
            Math.sin((p.x + p.y) * 0.0011 + t);
          p.vx += Math.cos(a * 1.6) * 0.022;
          p.vy += Math.sin(a * 1.6) * 0.022;
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy, R = 170;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) + 1, f = ((R * R - d2) / (R * R)) * 0.65;
            p.vx += (dx / d) * f; p.vy += (dy / d) * f;
          }
          p.vx *= 0.955; p.vy *= 0.955;
          p.x += p.vx; p.y += p.vy;
          if (p.x < -10) p.x = innerWidth + 10; else if (p.x > innerWidth + 10) p.x = -10;
          if (p.y < -10) p.y = innerHeight + 10; else if (p.y > innerHeight + 10) p.y = -10;
          const sp = Math.min(1, Math.hypot(p.vx, p.vy) / 1.4);
          g.fillStyle = `rgba(240,240,246,${0.08 + sp * 0.35})`;
          g.fillRect(p.x * DPR, p.y * DPR, 1.4 * DPR, 1.4 * DPR);
        }
      } else if (mode === "orbits") {
        const cx = (innerWidth / 2) * DPR, cy = (innerHeight / 2) * DPR;
        for (const p of orbitPs) {
          p.a += p.sp * 0.016;
          const x = cx + Math.cos(p.a) * p.r * DPR;
          const y = cy + Math.sin(p.a) * p.r * 0.7 * DPR;
          const sp = Math.abs(p.sp) / 0.14;
          g.fillStyle = `rgba(240,240,246,${0.08 + sp * 0.3})`;
          g.fillRect(x, y, p.s * DPR, p.s * DPR);
        }
      } else if (mode === "grid") {
        const gap = 46;
        for (let gx = gap / 2; gx < innerWidth; gx += gap) {
          for (let gy = gap / 2; gy < innerHeight; gy += gap) {
            const wave = 0.5 + 0.5 * Math.sin(t * 12 + gx * 0.013 + gy * 0.021);
            const dx = gx - mouse.x, dy = gy - mouse.y;
            const lift = Math.max(0, 1 - Math.hypot(dx, dy) / 180);
            const al = 0.04 + wave * 0.09 + lift * 0.5;
            const sz = (1.2 + lift * 2.2) * DPR;
            g.fillStyle = `rgba(240,240,246,${al})`;
            g.fillRect(gx * DPR - sz / 2, gy * DPR - sz / 2, sz, sz);
          }
        }
      } else { /* net */
        for (const p of netPs) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy, R = 150;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) + 1, f = ((R * R - d2) / (R * R)) * 0.4;
            p.vx += (dx / d) * f; p.vy += (dy / d) * f;
          }
          p.vx = p.vx * 0.99 + (Math.random() - 0.5) * 0.01;
          p.vy = p.vy * 0.99 + (Math.random() - 0.5) * 0.01;
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0) p.x = innerWidth; else if (p.x > innerWidth) p.x = 0;
          if (p.y < 0) p.y = innerHeight; else if (p.y > innerHeight) p.y = 0;
        }
        g.lineWidth = 1 * DPR;
        for (let i = 0; i < netPs.length; i++) {
          const a = netPs[i];
          for (let j = i + 1; j < netPs.length; j++) {
            const b = netPs[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 130 * 130) {
              g.strokeStyle = `rgba(240,240,246,${(1 - Math.sqrt(d2) / 130) * 0.14})`;
              g.beginPath();
              g.moveTo(a.x * DPR, a.y * DPR);
              g.lineTo(b.x * DPR, b.y * DPR);
              g.stroke();
            }
          }
          g.fillStyle = "rgba(240,240,246,0.4)";
          g.fillRect(a.x * DPR, a.y * DPR, 1.6 * DPR, 1.6 * DPR);
        }
      }
    };

    if (reduce) {
      for (const p of flowPs) {
        g.fillStyle = "rgba(240,240,246,0.12)";
        g.fillRect(p.x * DPR, p.y * DPR, 1.4 * DPR, 1.4 * DPR);
      }
    } else {
      raf = requestAnimationFrame(step);
    }

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [mode]);

  return (
    <div className="aurora" aria-hidden>
      <canvas ref={canvasRef} className="bg-field" />
    </div>
  );
}
