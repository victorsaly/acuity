import type { Metadata } from "next";

export const SITE_NAME = "Delulu Beats";
export const SITE_URL = "https://delulubeats.com";
export const SITE_DESCRIPTION =
  "Nine free browser perception games and a beat-making studio for rhythm, sound, memory, and timing.";
export const SOCIAL_IMAGE_ALT = "Delulu Beats — nine perception games for eyes, ears, and timing";
export const OPEN_GRAPH_IMAGE = `${SITE_URL}/social/opengraph.png`;
export const TWITTER_IMAGE = `${SITE_URL}/social/twitter.png`;

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
      title: socialTitle,
      description,
      images: [{ url: TWITTER_IMAGE, alt: SOCIAL_IMAGE_ALT }],
    },
  };
}
