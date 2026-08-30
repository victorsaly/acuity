import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sine Language",
  description: "Five tones play once each, then you pull every pitch back out of thin air.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
