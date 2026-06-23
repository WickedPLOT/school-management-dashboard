import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*"],
  turbopack: { root: '/home/unknwn/HAYRAT-CENTER-PLATFORM/frontend' },
  experimental: {
    serverActions: {
      bodySizeLimit: '35mb',
    },
  },
  async rewrites() {
    const backendTarget = process.env.BACKEND_PROXY_TARGET;
    if (!backendTarget) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backendTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
