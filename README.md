# Acuity

Three full-screen perception games. Your memory for color, pitch, and time is worse
than you think — prove otherwise.

**Play it: https://victorsaly.github.io/acuity/**

| Game | Tests | How |
| --- | --- | --- |
| **Afterimage** | Color memory | Five colors flood the screen, then you rebuild each one from HSL sliders |
| **Sine Language** | Pitch memory | Five tones play once, then you dial each back in on a log-scale frequency slider |
| **Downbeat** | Rhythm | Notes with little faces ride a living lane toward a hit ring — tap dead on time |

## Features

- Free play and a seeded **Daily** puzzle (same for everyone, per difficulty)
- Selectable **tone voices** (Warm / Pure / Organ / Chip) and **drum kits** (Punch / Boom / Club / Wood), all synthesized live with Web Audio — no samples
- Three Downbeat **lane formats**: Curve, Orbit, Rain
- Four ambient backgrounds — a different one on every refresh (or press `B`)
- Full keyboard control (`1–4` difficulty, `S` sound, `L` lane, `D` daily, `↵` start, `Esc` menu, `F` fullscreen)
- Rollover sound feedback on every control, perceptual Lab ΔE / cents / timing-window scoring, per-mode best scores

## Stack

Next.js (App Router, static export) · React · TypeScript · [Motion](https://motion.dev) for 3D UI transitions ·
Web Audio API (compressor + generated-impulse reverb bus, synthesized drums and voices) ·
Canvas for the waveform, note lane, and backgrounds.

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static export to out/
```

Pushes to `main` deploy to GitHub Pages automatically.

Inspired by the perception-game genre popularized by [dialed.gg](https://dialed.gg).
