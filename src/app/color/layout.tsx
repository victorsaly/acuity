import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Afterimage",
  "Five colors, one at a time, then nothing. Rebuild each one on a slider.",
  "/color/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
