import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopack: {
      // This forces Turbopack to only look inside the current folder
      root: '.',
    },
  },
};

export default nextConfig;
