import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Off-Grid",
  "One hit in an eight-step drum loop lands late. Say which one, before it gets too small to hear.",
  "/offgrid/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
