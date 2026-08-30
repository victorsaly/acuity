import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Beat Lab",
  "Build your own beat — rap, R&B or house. Pick and mix drums, bass, chords, melody and vocal chops; everything stays in key. Play it, then download it.",
  "/studio/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
