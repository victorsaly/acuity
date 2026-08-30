import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Off-Grid",
  description: "A drum loop repeats and exactly one hit lands late. Find it before the nudge shrinks past hearing.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
