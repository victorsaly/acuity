import type { Metadata } from "next";
import { Unbounded, Spline_Sans_Mono } from "next/font/google";
import Chrome from "@/components/Chrome";
import Aurora from "@/components/Aurora";
import "./globals.css";

const display = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const mono = Spline_Sans_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://victorsaly.github.io/acuity/"),
  title: { default: "Acuity", template: "%s · Acuity" },
  description:
    "Five full-screen perception games. Your memory for color, pitch, melody, time, and space is worse than you think — prove otherwise.",
  openGraph: {
    title: "Acuity",
    description: "Full-screen perception games: color, pitch, melody, tempo, and spatial memory.",
    url: "https://victorsaly.github.io/acuity/",
    siteName: "Acuity",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable}`}>
        <Aurora />
        <Chrome />
        {children}
      </body>
    </html>
  );
}
