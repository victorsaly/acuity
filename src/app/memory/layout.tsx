import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Echo",
  description: "Numbered tiles appear and vanish — tap them back in order, against the clock, as the grid keeps growing.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
