import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Sine Language",
  "Five tones, played once each. Then you go find the same pitches by ear.",
  "/sound/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
