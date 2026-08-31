import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Sine Language",
  "Five tones, played once each. Then you go find the same pitches by ear.",
  "/sound/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  /* data-game hands the whole route its accent (see globals.css). */
  return <div className="gameRoot" data-game="sound">{children}</div>;
}
