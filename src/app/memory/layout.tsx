import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Echo",
  description: "Tiles light up in a pattern, then go dark — tap it back from memory as the grid keeps growing.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
