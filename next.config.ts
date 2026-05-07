import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.cashercollection.com" },
      { protocol: "https", hostname: "cashercollection.com" },
    ],
  },
};

export default nextConfig;
