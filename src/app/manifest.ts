import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const dynamic = "force-static";

/* Preview builds are served from a subpath; production is at the root. The
   manifest is not rewritten for us, so every path in here is built by hand. */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const at = (path: string) => `${BASE}${path}`;

export default function manifest(): MetadataRoute.Manifest {
  return {
    /* Stable for the life of the app: change it and every install becomes a
       second, unrelated app on the home screen. */
    id: at("/"),
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "en-GB",
    dir: "ltr",
    start_url: at("/"),
    scope: at("/"),
    display: "standalone",
    /* No fullscreen: the games have their own fullscreen toggle, and taking
       the status bar away from someone who did not ask hides the clock on a
       site whose whole subject is knowing how long things take. */
    display_override: ["standalone", "minimal-ui"],
    /* Not locked. The hub is a rail on a wide screen and a column on a narrow
       one, and every game is playable either way up. */
    orientation: "any",
    background_color: "#0c0d12",
    theme_color: "#0c0d12",
    categories: ["games", "entertainment", "music"],
    icons: [
      /* Any browser that will take the vector should, but Android will not
         install from one — hence the raster pair beside it. */
      { src: at("/icon.svg"), sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: at("/icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: at("/icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      /* Full-bleed, mark well inside the safe zone: the launcher decides the
         shape, and a circle mask would otherwise clip the corners off. */
      { src: at("/icons/maskable-192.png"), sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: at("/icons/maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      { src: at("/icons/screenshot-wide.png"), sizes: "1240x720", type: "image/png",
        form_factor: "wide", label: "Nine games on the Delulu Beats hub" },
      { src: at("/icons/screenshot-narrow.png"), sizes: "720x1280", type: "image/png",
        form_factor: "narrow", label: "Nine games on the Delulu Beats hub" },
    ],
    /* Trailing slashes to match the export: without them the host answers
       with a redirect before the app has drawn anything. */
    shortcuts: [
      { name: "Leaderboard", short_name: "Board", url: at("/leaderboard/"),
        description: "Today's daily, ranked, across every game" },
      { name: "Beat Lab", short_name: "Lab", url: at("/studio/"),
        description: "Build a track. Nothing to score." },
    ],
  };
}
