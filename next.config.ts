import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const SECURITY_HEADERS = [
  // Two years, per hstspreload.org guidance.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // SAMEORIGIN (not DENY): the app frames its own PDF score viewer.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      { source: "/pricing", destination: "/hosting", permanent: true },
      { source: "/settings", destination: "/studio", permanent: true },
    ];
  },
};

export default nextConfig;
