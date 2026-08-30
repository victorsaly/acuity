import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fever Dream",
  description: "A possessed microwave keeps the beat. Read its movement and tap before breakfast escapes.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}