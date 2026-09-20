import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingIncludes: {
    "/maplibre/[file]": [
      "./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
      "./node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs",
    ],
  },
};

export default nextConfig;
