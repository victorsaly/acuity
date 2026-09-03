import type { Metadata, Viewport } from "next";
import { Unbounded, Spline_Sans_Mono } from "next/font/google";
import Chrome from "@/components/Chrome";
import Aurora from "@/components/Aurora";
import ArcadeSession from "@/components/ArcadeSession";
import InstallApp from "@/components/InstallApp";
import SoundGate from "@/components/SoundGate";
import {
  OPEN_GRAPH_IMAGE,
  REPOSITORY_URL,
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
    "free online games",
    "browser games",
    "music games",
    "rhythm games",
    "perception games",
    "memory games",
    "audio games",
    "timing games",
    "ear training games",
    "Beat Lab",
  ],
  category: "games",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  /* iOS installs from these rather than from the manifest: it wants an opaque
     icon of its own, and it is the only way to get the standalone window. */
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    /* The app is dark everywhere, so the status bar should be too. */
    statusBarStyle: "black-translucent",
  },
  /* Next emits only the current `mobile-web-app-capable`. iOS before 16.4 —
     still a lot of phones — reads the Apple-prefixed one and nothing else,
     and without it the app opens in a Safari tab with a URL bar. */
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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

/* Installed, the app draws into the whole window, notch included, and the
   games position against the viewport rather than the safe area. */
export const viewport: Viewport = {
  themeColor: "#0c0d12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /* A rhythm game is a lot of fast repeated taps, and every one of them is a
     candidate for a double-tap zoom the player did not ask for. */
  maximumScale: 1,
  userScalable: false,
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "GameApplication",
  applicationSubCategory: "Music, rhythm, memory, and perception games",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern browser with Web Audio API support",
  isAccessibleForFree: true,
  image: OPEN_GRAPH_IMAGE,
  screenshot: OPEN_GRAPH_IMAGE,
  sameAs: [REPOSITORY_URL],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
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
        <ArcadeSession />
        <InstallApp />
        <Aurora />
        <SoundGate />
        <Chrome />
        {children}
      </body>
    </html>
  );
}
