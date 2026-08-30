import { routeMetadata } from "@/lib/site";
import styles from "./page.module.css";

export const metadata = routeMetadata(
  "About & Credits",
  "Meet the father-and-son team behind Delulu Beats and learn what inspired its nine browser-based perception games.",
  "/about/",
);

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
            <p>
              Delulu Beats was created and vibe-coded by <strong>Oliver Saly</strong> and his dad,
              {" "}<strong>Victor Saly</strong>.
            </p>
            <p>
              It is a father-and-son project built around short, strange challenges that are easy to
              start and difficult to master.
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