import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Off-Grid",
  "A drum loop repeats and exactly one hit lands late. Find it before the nudge shrinks past hearing.",
  "/offgrid/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
