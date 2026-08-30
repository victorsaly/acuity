import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Sine Language",
  "Five tones play once each, then you pull every pitch back out of thin air.",
  "/sound/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
