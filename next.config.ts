import type { NextConfig } from "next";

const wordpressBaseUrl =
  process.env.WORDPRESS_BASE_URL || "https://cms.redlinelandscapingky.com";
const wordpressUploadsHost = new URL(wordpressBaseUrl).hostname;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: wordpressUploadsHost,
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
