import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refrain",
  description: "A piano melody grows one note every level — play the same notes back in order before the clock runs out.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
