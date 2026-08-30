import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Echo",
  "Numbered tiles appear and vanish — tap them back in order, against the clock, as the grid keeps growing.",
  "/memory/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
