import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Permissions-Policy", value: "geolocation=(self), microphone=(self)" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/maplibre/[file]": [
      "./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
      "./node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs",
    ],
    "/api/suggest": ["./src/data/taiwan-poi-index.json.gz", "./src/data/taiwan-poi-index.json"],
    "/api/geocode": ["./src/data/taiwan-poi-index.json.gz", "./src/data/taiwan-poi-index.json"],
    "/api/pois": ["./src/data/taiwan-poi-index.json.gz", "./src/data/taiwan-poi-index.json"],
    "/api/pois/sync": ["./src/data/taiwan-poi-index.json.gz", "./src/data/taiwan-poi-index.json"],
  },
};

export default nextConfig;
