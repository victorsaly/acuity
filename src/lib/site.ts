import type { Metadata } from "next";

export const SITE_NAME = "Delulu Beats";
export const SITE_URL = "https://delulubeats.com";
export const REPOSITORY_URL = "https://github.com/victorsaly/delulubeats";
export const SITE_DESCRIPTION =
  "Play nine free browser rhythm, music, memory, and perception games. Test your eyes, ears, and timing, then build a track in Beat Lab.";
export const SOCIAL_IMAGE_ALT = "Delulu Beats: nine small games for your eyes, ears and sense of timing";
export const OPEN_GRAPH_IMAGE = `${SITE_URL}/social/opengraph.png`;
export const TWITTER_IMAGE = `${SITE_URL}/social/twitter.png`;

/* Every game has its own card in public/social, drawn from the same art as
   its tile on the hub (scripts/gen-social.mjs). A shared score previews as
   the game it came from rather than one generic image for the whole site. */
export const socialImage = (path: string) => {
  const slug = path.replace(/\//g, "");
  return `${SITE_URL}/social/${slug || "opengraph"}.png`;
};

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
  const image = socialImage(path);
  const imageAlt = `${title}: ${description}`;
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
        url: image,
        width: 1200,
        height: 630,
        alt: imageAlt,
        type: "image/png",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [{ url: image, alt: imageAlt }],
    },
  };
}
