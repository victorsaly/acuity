import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Refrain",
  "A piano melody grows one note every level — play the same notes back in order before the clock runs out.",
  "/piano/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
