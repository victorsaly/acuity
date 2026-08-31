import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Refrain",
  "A piano phrase plays and you play it back. One note longer every level.",
  "/piano/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  /* data-game hands the whole route its accent (see globals.css). */
  return <div className="gameRoot" data-game="piano">{children}</div>;
}
