import Link from "next/link";
import { routeMetadata } from "@/lib/site";
import styles from "./page.module.css";

export const metadata = routeMetadata(
  "About & Credits",
  "Meet the father-and-son team behind Delulu Beats and learn what inspired its nine browser-based perception games.",
  "/about/",
);

const GAMES = [
  { href: "/color", label: "Afterimage" },
  { href: "/sound", label: "Sine Language" },
  { href: "/time", label: "Second Sense" },
  { href: "/tempo", label: "Downbeat" },
  { href: "/memory", label: "Echo" },
  { href: "/piano", label: "Refrain" },
  { href: "/fever", label: "Fever Dream" },
  { href: "/phantom", label: "Phantom Drop" },
  { href: "/offgrid", label: "Off-Grid" },
];

const CREDITS = [
  { what: "Sound engine", how: "Every game sound is synthesized live in your browser with the Web Audio API — drums, keys, bass and blips share one mastered signal chain." },
  { what: "Drum kits & vocal chops", how: "One-shot samples generated with the ElevenLabs Sound Effects API, then layered over the synth engine." },
  { what: "Framework", how: "Next.js and React, statically exported and served from GitHub Pages." },
  { what: "Vibe-coding", how: "Built in conversation with Claude Code." },
];

export default function AboutPage() {
  return (
    <main className={`stage menuStage ${styles.stage}`}>
      <article className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>About the project</p>
          <h1 className={styles.title}>Delulu Beats</h1>
          <p className={styles.lede}>
            Nine free browser games that put your eyes, ears, memory, and sense of timing to the test.
            Plus Beat Lab, where you can build and download your own track. No account, no download —
            just pick something and play.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="makers">
          <h2 id="makers">Made together</h2>
          <div>
            <div className={styles.makers}>
              <div className={styles.maker}>
                <span className={styles.avatar} aria-hidden>OS</span>
                <span className={styles.makerName}>Oliver Saly</span>
                <span className={styles.makerRole}>Co-creator</span>
              </div>
              <div className={styles.maker}>
                <span className={styles.avatar} aria-hidden>VS</span>
                <span className={styles.makerName}>Victor Saly</span>
                <span className={styles.makerRole}>Co-creator</span>
              </div>
            </div>
            <p>
              Delulu Beats was created and vibe-coded by <strong>Oliver Saly</strong> and his dad,
              {" "}<strong>Victor Saly</strong> — a father-and-son project built around short, strange
              challenges that are easy to start and difficult to master.
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="inspiration">
          <h2 id="inspiration">Inspiration</h2>
          <div>
            <p>
              The games draw inspiration from playful browser experiments such as{" "}
              <a href="https://neal.fun/" target="_blank" rel="noopener noreferrer">Neal.fun</a>
              {" "}and the perception-game genre popularized by{" "}
              <a href="https://dialed.gg/" target="_blank" rel="noopener noreferrer">dialed.gg</a>.
            </p>
            <p>Delulu Beats is an original, independent project and is not affiliated with either site.</p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="everything">
          <h2 id="everything">Play everything</h2>
          <div>
            <div className={styles.gamesGrid}>
              {GAMES.map((g, i) => (
                <Link key={g.href} href={g.href} className={styles.gameChip} data-note={440 + i * 30}>
                  {g.label}
                </Link>
              ))}
              <Link href="/studio" className={`${styles.gameChip} ${styles.labChip}`} data-note={1397}>
                Beat Lab ▸
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="credits">
          <h2 id="credits">Built with</h2>
          <div>
            <dl className={styles.credits}>
              {CREDITS.map((c) => (
                <div key={c.what}>
                  <dt>{c.what}</dt>
                  <dd>{c.how}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="privacy">
          <h2 id="privacy">Good to know</h2>
          <div>
            <p>
              Scores, preferences, and streaks stay in your browser. Most games use sound, so headphones
              are recommended. Everything works with mouse, keyboard, or touch.
            </p>
          </div>
        </section>

        <p className={styles.signoff}>Made for curious ears and questionable confidence.</p>
      </article>
    </main>
  );
}
