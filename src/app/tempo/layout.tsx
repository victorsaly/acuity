import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Downbeat",
  description: "Notes ride a living lane toward the ring — tap dead on time.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
