import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Phantom Drop",
  "The beat cuts out before the drop. Keep counting through the silence and land the 1.",
  "/phantom/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}