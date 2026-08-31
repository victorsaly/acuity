import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Fever Dream",
  "A microwave is keeping the beat. Read how it moves, then keep the pulse alone.",
  "/fever/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}