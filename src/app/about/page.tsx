import Link from "next/link";
import { REPOSITORY_URL, routeMetadata } from "@/lib/site";
import styles from "./page.module.css";

export const metadata = routeMetadata(
  "About & Credits",
  "Who made Delulu Beats, what it was built with, and where the nine games came from.",
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
  { what: "Sound engine", how: "Nothing is streamed. Every drum, key, bass note and blip is generated in your browser with the Web Audio API, all running through one shared mastering chain." },
  { what: "Drum kits & vocal chops", how: "One-shot samples made with the ElevenLabs Sound Effects API, layered on top of the synths." },
  { what: "Framework", how: "Next.js and React, exported as static files and served from GitHub Pages. No server, no database." },
  { what: "Vibe-coding", how: "Most of this was written in conversation with Claude Code." },
];

export default function AboutPage() {
  return (
    <main className={`stage menuStage ${styles.stage}`}>
      <article className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>What this is</p>
          <h1 className={styles.title}>Delulu Beats</h1>
          <p className={styles.lede}>
            Nine small games about what you actually noticed. Was that color that red? Was that
            gap that long? Usually not. There is also Beat Lab, which isn&apos;t a game at all: it&apos;s a
            studio for building a track and taking it home. Nothing to install, nothing to sign up for.
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
              Delulu Beats is a father-and-son side project by <strong>Oliver Saly</strong> and his dad,
              {" "}<strong>Victor Saly</strong>. Every game here is quick to pick up and stubborn to get
              good at, which is roughly the point.
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="inspiration">
          <h2 id="inspiration">Inspiration</h2>
          <div>
            <p>
              We got the idea from{" "}
              <a href="https://neal.fun/" target="_blank" rel="noopener noreferrer">Neal.fun</a>
              {" "}and{" "}
              <a href="https://dialed.gg/" target="_blank" rel="noopener noreferrer">dialed.gg</a>
              {" "}— sites where you open a tab, do one strange thing, and close it again.
            </p>
            <p>This is our own project and we&apos;re not connected to either of them.</p>
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
              <div>
                <dt>Source code</dt>
                <dd>
                  Explore the project, report an issue, or follow its development on{" "}
                  <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">GitHub</a>.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="privacy">
          <h2 id="privacy">Good to know</h2>
          <div>
            <p>
              Your scores, settings and streaks live in your browser and nowhere else. Clear your site
              data and they are gone for good, which is a risk we are quietly asking you to accept.
              Sound matters in most of the games, so headphones help. Mouse, keyboard and touch all work.
            </p>
          </div>
        </section>

        <p className={styles.signoff}>
          No leaderboard. Just you and the number, and the number does not care.
        </p>
      </article>
    </main>
  );
}
