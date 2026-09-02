/**
 * The daily challenges, and what a run of one is worth.
 *
 * SHARED SOURCE. This exact file is copied into the leaderboard Worker by
 * `npm run sync:arcade`, and the Worker's suite fails if its copy has drifted.
 * That is the whole point of it existing: the server has to rebuild the same
 * challenge the game dealt and score it the same way, and six games' worth of
 * hand-mirrored arithmetic is six chances to get it silently wrong — where
 * "wrong" means quietly rejecting every honest score.
 *
 * So: plain JavaScript, no TypeScript syntax, no imports, no DOM, no audio.
 * It must run unchanged in a browser and in a Worker.
 */

/* ---------- the generator, shared with both games ---------- */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Echo: recall a grid of numbered tiles ---------- */

export const ECHO = {
  grid: { easy: 4, hard: 5, brutal: 6 },
  startTiles: 4,
  lives: 3,
};

/** How many tiles level `level` shows. */
export function echoCount(level, cells) {
  return Math.min(level + ECHO.startTiles - 1, cells - 1);
}

/**
 * The pattern for one level.
 *
 * A whole Fisher-Yates over every cell runs each level even though only the
 * first `count` are used, so the draws consumed per level are fixed and the
 * sequence stays reconstructable.
 */
export function echoPattern(rng, cells, level) {
  const pool = Array.from({ length: cells }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, echoCount(level, cells));
}

/**
 * Replay a run of Echo. `taps` is one array of cell indices per level.
 * Returns levels cleared, or null if the run could not have happened.
 */
export function echoScore(seed, level, taps) {
  const n = ECHO.grid[level];
  if (!n || !Array.isArray(taps)) return null;
  const cells = n * n;
  const rng = mulberry32(seed >>> 0);
  let cleared = 0;
  let lives = ECHO.lives;

  for (let i = 0; i < taps.length; i += 1) {
    if (lives <= 0) return null; // the run should have ended already
    const pattern = echoPattern(rng, cells, cleared + 1);
    const attempt = taps[i];
    if (!Array.isArray(attempt) || attempt.length > pattern.length) return null;
    if (!attempt.every((c) => Number.isInteger(c) && c >= 0 && c < cells)) return null;

    const perfect =
      attempt.length === pattern.length && attempt.every((c, k) => c === pattern[k]);
    if (perfect) cleared += 1;
    else lives -= 1;
  }
  return cleared;
}

/* ---------- Refrain: play back a growing melody ---------- */

const BLACK = new Set([1, 3, 6, 8, 10]);

export const REFRAIN = {
  /** Semitones spanned, and whether the black keys are in play. */
  span: { easy: 13, hard: 13, brutal: 17 },
  whitesOnly: { easy: true, hard: false, brutal: false },
  startNotes: 3,
  lives: 3,
};

/**
 * How many keys the board actually shows.
 *
 * Counted rather than tabulated: the melody walks over key *indices*, so an
 * off-by-one here silently generates a different tune from the game's.
 */
export function refrainKeyCount(level) {
  const span = REFRAIN.span[level];
  if (!span) return null;
  const whitesOnly = REFRAIN.whitesOnly[level];
  let count = 0;
  for (let s = 0; s < span; s += 1) {
    if (whitesOnly && BLACK.has(s % 12)) continue;
    count += 1;
  }
  return count;
}

/**
 * Grow the melody by one note, as a seeded walk in small singable steps.
 * Mirrors `extend()` in the game, for the "auto" phrase only — a chosen
 * phrase preset is fixed and uses no randomness, so the daily locks to auto.
 */
export function refrainExtend(rng, melody, n) {
  const prev = melody[melody.length - 1];
  let next;
  if (prev === undefined) {
    next = Math.floor(n / 2 + rng() * 5 - 2);
  } else {
    const delta = (1 + Math.floor(rng() * 4)) * (rng() < 0.5 ? -1 : 1);
    next = prev + delta;
    if (next < 0 || next >= n) next = prev - delta;
    next = Math.max(0, Math.min(n - 1, next));
    if (next === prev) next = prev + (prev > 0 ? -1 : 1);
  }
  melody.push(next);
  return melody;
}

/** The melody after `levels` levels: three notes, then one more each time. */
export function refrainMelody(rng, n, levels) {
  const melody = [];
  for (let k = 0; k < REFRAIN.startNotes; k += 1) refrainExtend(rng, melody, n);
  for (let l = 1; l < levels; l += 1) refrainExtend(rng, melody, n);
  return melody;
}

/** Replay a run of Refrain. `taps` is one array of key indices per level. */
export function refrainScore(seed, level, taps) {
  const n = refrainKeyCount(level);
  if (!n || !Array.isArray(taps)) return null;
  const rng = mulberry32(seed >>> 0);
  const melody = [];
  let cleared = 0;
  let lives = REFRAIN.lives;

  for (let i = 0; i < taps.length; i += 1) {
    if (lives <= 0) return null;
    // The phrase grows before each level is played.
    const add = melody.length === 0 ? REFRAIN.startNotes : 1;
    for (let k = 0; k < add; k += 1) refrainExtend(rng, melody, n);

    const attempt = taps[i];
    if (!Array.isArray(attempt) || attempt.length > melody.length) return null;
    if (!attempt.every((k) => Number.isInteger(k) && k >= 0 && k < n)) return null;

    const perfect =
      attempt.length === melody.length && attempt.every((k, j) => k === melody[j]);
    if (perfect) cleared += 1;
    else lives -= 1;
  }
  return cleared;
}

/* ---------- Downbeat: hit the notes as they land ---------- */

/*
 * The patterns themselves, so the note count is counted rather than tabulated.
 * Only kicks and snares are playable — hats and opens are heard, not hit — so
 * only those two are listed here.
 */
export const DOWNBEAT = {
  patterns: {
    basic: { kick: 2, snare: 2 },
    boomBap: { kick: 3, snare: 2 },
    stillDre: { kick: 5, snare: 2 },
    crankThat: { kick: 6, snare: 2 },
    breaks: { kick: 4, snare: 3 },
  },
  tracks: {
    easy: [{ p: 'basic', bars: 8 }],
    medium: [{ p: 'boomBap', bars: 10 }],
    hard: [{ p: 'stillDre', bars: 8 }, { p: 'crankThat', bars: 8 }],
    brutal: [
      { p: 'stillDre', bars: 8 },
      { p: 'breaks', bars: 8 },
      { p: 'crankThat', bars: 8 },
    ],
  },
  /** What a tap is worth, by how close it landed. */
  values: { perfect: 1, good: 0.6, ok: 0.3 },
  strayCost: 0.15,
};

/** How many playable notes a difficulty's timeline holds. */
export function downbeatNotes(level) {
  const tracks = DOWNBEAT.tracks[level];
  if (!tracks) return null;
  return tracks.reduce((sum, t) => {
    const pat = DOWNBEAT.patterns[t.p];
    return sum + (pat ? (pat.kick + pat.snare) * t.bars : 0);
  }, 0);
}

/**
 * Score a run of Downbeat from its tallies.
 *
 * The game's own formula: every note is worth 1, 0.6 or 0.3 by how close the
 * tap was, a tap that hit nothing costs 0.15, and the total is a percentage of
 * a flawless run. Returned in tenths, like every other Beats score.
 */
export function downbeatScore(level, counts) {
  const notes = downbeatNotes(level);
  if (notes === null || !counts) return null;
  const { perfect = 0, good = 0, ok = 0, strays = 0 } = counts;
  const tallies = [perfect, good, ok, strays];
  if (!tallies.every((v) => Number.isInteger(v) && v >= 0)) return null;
  // You cannot hit more notes than the timeline holds.
  if (perfect + good + ok > notes) return null;
  if (strays > notes * 4) return null;

  const points =
    perfect * DOWNBEAT.values.perfect + good * DOWNBEAT.values.good + ok * DOWNBEAT.values.ok;
  const pct = Math.max(0, ((points - strays * DOWNBEAT.strayCost) / Math.max(1, notes)) * 100);
  return Math.round(pct * 10);
}
