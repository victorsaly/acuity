<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Delulu Beats

## Timing: rhythm games run on the audio clock

Anything the player is scored against, and anything on screen that a beat is
supposed to line up with, is a point on `AudioContext.currentTime` — never a
`setTimeout` on `performance.now()`.

- Schedule notes at an absolute `currentTime` in the future.
- Read taps with `heardNow()` from `src/lib/audio.ts`. It returns
  `currentTime - outputLatency`: the time of the sound reaching the ears right
  now, so a tap compared against a note's scheduled time scores zero error.
- Drive visuals from a `requestAnimationFrame` loop that reads `heardNow()` and
  fires cues whose time has passed. Off-Grid's `Cue`/`pump`/`schedule` trio is
  the pattern to copy.

The failure this prevents: audio on one clock and lights/scoring on another
drift apart by tens of milliseconds, which is most of a scoring window — and
all of a 14ms nudge in Off-Grid. `performance.now()` is still correct for a
duration that is not synced to sound (see `/time`, which measures a held
button).

## A listening game must not play the thing it asks you to hear

Phantom Drop once sounded the drop it was asking you to predict, and Fever
Dream ran a click track under the bars you were supposed to carry alone. Both
still typechecked, linted and looked right; both had quietly become reaction
tests. One extra line in a scheduling loop is all it takes.

`npm run test:audio` guards this. It records every scheduled onset by patching
`AudioBufferSourceNode`/`OscillatorNode.start` in the page and asserts that
nothing sounds in the windows the player is supposed to hear nothing. Run it
against a dev server; it needs Chrome installed. If you add or change a
scheduling loop in a rhythm game, run it, and add the matching invariant for
any new game.

Note when reading its output: one drum hit is several sources (a clap is two
noise bursts 28ms apart), so onsets are clustered before analysis, and the
first onset after Start is the button's own UI blip.
