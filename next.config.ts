import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/pricing", destination: "/hosting", permanent: true }];
  },
};

export default nextConfig;
