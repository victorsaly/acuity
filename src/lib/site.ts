import type { Metadata } from "next";

export const SITE_NAME = "Delulu Beats";
export const SITE_URL = "https://delulubeats.com";
export const SITE_DESCRIPTION =
  "Nine free browser perception games and a beat-making studio for rhythm, sound, memory, and timing.";

export const GAME_ROUTES = [
  "/color",
  "/sound",
  "/time",
  "/tempo",
  "/memory",
  "/piano",
  "/fever",
  "/phantom",
  "/offgrid",
] as const;

export function routeMetadata(title: string, description: string, path: string): Metadata {
  const socialTitle = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "en_GB",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
    },
  };
}