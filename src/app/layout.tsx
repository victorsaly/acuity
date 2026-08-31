import type { Metadata } from "next";
import { Unbounded, Spline_Sans_Mono } from "next/font/google";
import Chrome from "@/components/Chrome";
import Aurora from "@/components/Aurora";
import SoundGate from "@/components/SoundGate";
import {
  OPEN_GRAPH_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  SOCIAL_IMAGE_ALT,
  TWITTER_IMAGE,
} from "@/lib/site";
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
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  authors: [{ name: "Oliver Saly" }, { name: "Victor Saly" }],
  creator: "Oliver Saly and Victor Saly",
  publisher: "Oliver Saly and Victor Saly",
  keywords: [
    "browser games",
    "music games",
    "rhythm games",
    "perception games",
    "memory games",
    "audio games",
  ],
  category: "games",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "website",
    images: [{
      url: OPEN_GRAPH_IMAGE,
      width: 1200,
      height: 630,
      alt: SOCIAL_IMAGE_ALT,
      type: "image/png",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: TWITTER_IMAGE, alt: SOCIAL_IMAGE_ALT }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "GameApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern browser with Web Audio API support",
  isAccessibleForFree: true,
  creator: [
    { "@type": "Person", name: "Oliver Saly" },
    { "@type": "Person", name: "Victor Saly" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
        <Aurora />
        <SoundGate />
        <Chrome />
        {children}
      </body>
    </html>
  );
}
