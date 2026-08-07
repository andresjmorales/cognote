import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return [
      { source: "/pricing", destination: "/hosting", permanent: true },
      { source: "/settings", destination: "/studio", permanent: true },
    ];
  },
};

export default nextConfig;
