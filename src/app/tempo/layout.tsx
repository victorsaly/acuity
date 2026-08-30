import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Downbeat",
  "Notes ride a living lane toward the ring — tap dead on time.",
  "/tempo/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
