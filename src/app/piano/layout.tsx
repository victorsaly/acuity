import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Refrain",
  "A piano phrase plays and you play it back. One note longer every level.",
  "/piano/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
