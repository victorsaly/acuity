import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Fever Dream",
  "A microwave is keeping the beat. Read how it moves, then keep the pulse alone.",
  "/fever/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  /* data-game hands the whole route its accent (see globals.css). */
  return <div className="gameRoot" data-game="fever">{children}</div>;
}