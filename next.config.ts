import type { NextConfig } from "next";
import path from "path";

// Keep optional subpath support for preview deployments. The production
// custom domain builds at the root.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
