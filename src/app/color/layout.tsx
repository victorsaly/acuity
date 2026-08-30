import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Afterimage",
  description: "Five colors flood the screen, then you rebuild each one from memory.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
