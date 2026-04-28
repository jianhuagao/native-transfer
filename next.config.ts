import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["172.16.1.79"],
  images: {
    localPatterns: [
      {
        pathname: "/api/images/**",
      },
    ],
    qualities: [100, 70, 75, 78, 90],
  },
};

export default nextConfig;
