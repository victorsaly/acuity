import Link from "next/link";

export const metadata = {
  title: "Nothing here",
  description: "This page does not exist. The rest of Delulu Beats does.",
  robots: { index: false, follow: true },
};

/* Places we did not find the page, in the order we did not find it. */
const SEARCHED = [
  "Behind the microwave",
  "In the silent bar of Phantom Drop",
  "Under step 5, which is late anyway",
  "The one color nobody ever guesses",
];

export default function NotFound() {
  return (
    <main className="stage menuStage">
      <div className="nf404" aria-hidden>404</div>
      <h1 className="resVerdict">You missed the beat.</h1>
      <p className="tagline">
        There is no page at this address. We looked. Here is where we looked.
      </p>
      <ul className="nfList">
        {SEARCHED.map((place) => (
          <li key={place}>{place}</li>
        ))}
      </ul>
      <div className="menuActions">
        <Link href="/" className="cta" data-note="440">Back to the games</Link>
        <Link href="/fever" className="ghost" data-note="349">Try the microwave one</Link>
      </div>
      <div className="hint">
        Error 404 · the only score here that goes up when you fail
      </div>
    </main>
  );
}
