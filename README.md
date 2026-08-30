# Acuity

Five full-screen perception games. Your memory for color, pitch, melody, time, and space
are worse than you think — prove otherwise.

**Play it: https://victorsaly.github.io/acuity/**

| Game | Tests | How |
| --- | --- | --- |
| **Afterimage** | Color memory | Five colors flood the screen, then you rebuild each one from HSL sliders |
| **Sine Language** | Pitch memory | Five tones play once, then you dial each back in on a log-scale frequency slider |
| **Downbeat** | Rhythm | Notes with little faces ride a living lane toward a hit ring — tap dead on time |
| **Echo** | Spatial memory | Numbered tiles appear on a 4×4–6×6 grid, then vanish — tap them back in order before the clock runs out, one more tile per level |
| **Refrain** | Melody | A piano phrase grows one note per level — play the same notes back in order, watching the keys or purely by ear |

## Features

- Free play and a seeded **Daily** puzzle (same for everyone, per difficulty)
- **One at a time** (guess each color/tone right after it appears) or **All five first** flows for the memory games
- Selectable **tone voices** (Warm / Pure / Organ / Chip) and **drum kits** (Punch / Boom / Club / Wood) — sampled one-shots with a live Web Audio synth fallback
- Three Downbeat **lane formats**: Curve, Orbit, Rain — notes are little faces that grin when you hit them
- Refrain's on-screen piano is playable by mouse, touch, or the `A–'` / `W–[` keyboard rows — **Watch** (keys light up) or **By ear** (sound only) formats
- Live decimal points while you play, a racing hundredths countdown with accelerating ticks, and a confetti fanfare on a new best
- **Share score** cards (Wordle-style emoji), per-game play counts and daily streaks on the hub, remembered preferences
- Four ambient backgrounds — a different one on every refresh (or press `B`)
- Full keyboard control (`1–4` difficulty, `S` sound, `L` format, `D` daily, `↵` start, `Esc` menu, `F` fullscreen); works on touch too
- Rollover sound feedback on every control, perceptual Lab ΔE / cents / latency-compensated timing scoring, per-mode best scores

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
