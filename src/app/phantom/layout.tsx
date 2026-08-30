import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phantom Drop",
  description: "The beat cuts out before the drop. Keep time in the silence and bring it back on cue.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}