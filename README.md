# Delulu Beats

Delulu Beats is a collection of six full-screen perception games for color, pitch,
duration, rhythm, spatial memory, and melody. See it, hear it, remember it, then try to dial it
back in.

**Play now: https://delulubeats.com/**

| Game | Challenge | How it works |
| --- | --- | --- |
| **Afterimage** | Color memory | Rebuild five colors from memory with HSL controls |
| **Sine Language** | Pitch memory | Hear five tones, then recover each pitch on a frequency slider |
| **Second Sense** | Time perception | Feel each duration, then hold and release to recreate it without a clock |
| **Downbeat** | Rhythm and timing | Follow the track and hit each incoming note on the beat |
| **Echo** | Spatial memory | Recall numbered tiles on increasingly difficult grids before time runs out |
| **Refrain** | Melody memory | Replay a piano phrase that grows by one note each level |

## What's included

- Free Play and a seeded **Daily** challenge shared by everyone at each difficulty
- Easy, Hard, and Brutal difficulty levels, plus a fourth Medium level in Downbeat
- **One at a time** and **All five first** recall formats for Afterimage and Sine Language
- Warm, Pure, Organ, and Chip tone voices in Sine Language
- Punch, Boom, Club, and Wood sampled drum kits in Downbeat, with a synthesized fallback
- Curve, Orbit, and Rain note lanes plus selectable tracks in Downbeat
- Flash and Trail reveal formats in Echo
- Watch and By ear formats plus selectable phrase styles in Refrain
- Mouse, keyboard, and touch input, including a playable on-screen piano
- Per-mode best scores, play counts, daily streaks, saved preferences, and new-best celebrations
- Shareable emoji score cards with native sharing, clipboard fallback, and WhatsApp sharing
- Built-in How to play guides, audio feedback, fullscreen mode, and four animated backgrounds

Keyboard shortcuts appear in each game. Common controls include number keys for difficulty,
`D` for Daily, `Enter` to start, `Esc` to return to the menu, and `F` for fullscreen.
Contextual shortcuts are shown for sound, format, beat, and background options.

## Stack

- Next.js App Router with static export
- React and TypeScript
- [Motion](https://motion.dev) for interface transitions
- Web Audio API for synthesized voices, drum playback, effects, and timing
- Canvas for waveforms, rhythm lanes, and animated backgrounds

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build    # static export to out/
```

Pushes to `main` deploy automatically to GitHub Pages at
[delulubeats.com](https://delulubeats.com/).

Inspired by the perception-game genre popularized by [dialed.gg](https://dialed.gg).
