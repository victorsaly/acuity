import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Second Sense",
  "Five stretches of time. Hold the button for exactly as long, with no clock to help.",
  "/time/",
);

export default function TimeLayout({ children }: { children: React.ReactNode }) {
  return children;
}