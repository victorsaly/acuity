import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Second Sense",
  "Experience five durations, then recreate each one from memory without a clock.",
  "/time/",
);

export default function TimeLayout({ children }: { children: React.ReactNode }) {
  return children;
}