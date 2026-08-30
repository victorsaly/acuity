import { routeMetadata } from "@/lib/site";

export const metadata = routeMetadata(
  "Phantom Drop",
  "The beat cuts out before the drop. Keep time in the silence and bring it back on cue.",
  "/phantom/",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}