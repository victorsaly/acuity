import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Fever Dream",
  "A possessed microwave keeps the beat. Read its movement and tap before breakfast escapes.",
  "/fever/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}