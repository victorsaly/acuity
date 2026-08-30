import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Second Sense",
  description: "Experience five durations, then recreate each one from memory without a clock.",
};

export default function TimeLayout({ children }: { children: React.ReactNode }) {
  return children;
}