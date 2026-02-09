import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "redlinelandscapingky.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "i0.wp.com",
      },
      {
        protocol: "https",
        hostname: "i1.wp.com",
      },
      {
        protocol: "https",
        hostname: "i2.wp.com",
      },
    ],
  },
};

export default nextConfig;
