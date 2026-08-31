import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Echo",
  "Numbered tiles light up and go dark. Tap them back in order before the clock runs out.",
  "/memory/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  /* data-game hands the whole route its accent (see globals.css). */
  return <div className="gameRoot" data-game="memory">{children}</div>;
}
