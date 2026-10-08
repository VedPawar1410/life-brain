import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: { position: "top-right" }, // keep the dev badge clear of the bottom nav
  cacheComponents: true,
  partialPrefetching: true,
  // Phone access goes through Tailscale (https://<mac>.<tailnet>.ts.net), which the dev
  // server would otherwise block as an unknown origin.
  allowedDevOrigins: ["**.ts.net"],
  // The browser only ever talks to this Next.js server; /api/* is proxied to FastAPI on the
  // server side. One origin means the phone needs a single URL and no CORS is involved.
  async rewrites() {
    const backend = process.env.API_PROXY_TARGET ?? "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${backend}/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
