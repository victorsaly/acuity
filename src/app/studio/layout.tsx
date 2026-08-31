import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Beat Lab",
  "Stack drums, bass, chords, melody and vocal chops in rap, R&B or house. Everything stays in key. Download what you make.",
  "/studio/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
