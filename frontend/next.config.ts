import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*"],
  turbopack: { root: '/home/unknwn/HAYRAT-CENTER-PLATFORM/frontend' },
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
