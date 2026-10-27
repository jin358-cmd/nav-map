import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/maplibre/[file]": [
      "./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
      "./node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs",
    ],
    "/api/roadwork": ["./fixtures/roadwork/structural-notices.json"],
  },
};

export default nextConfig;
