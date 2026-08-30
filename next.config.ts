import type { NextConfig } from "next";
import path from "path";

// On GitHub Pages the site lives under /<repo>, injected by the
// deploy workflow via PAGES_BASE_PATH. Local dev/build serve from /.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
