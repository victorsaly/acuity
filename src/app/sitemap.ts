import type { MetadataRoute } from "next";
import { GAME_ROUTES, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/about/`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${SITE_URL}/studio/`, changeFrequency: "monthly", priority: 0.9 },
    ...GAME_ROUTES.map((route) => ({
      url: `${SITE_URL}${route}/`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}