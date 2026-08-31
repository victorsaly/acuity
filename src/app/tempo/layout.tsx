import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Downbeat",
  "Asteroids tumble in on the beat. Tap them at the ring, dead on time.",
  "/tempo/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  /* data-game hands the whole route its accent (see globals.css). */
  return <div className="gameRoot" data-game="tempo">{children}</div>;
}
