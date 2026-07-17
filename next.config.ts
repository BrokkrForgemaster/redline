import type { NextConfig } from "next";

const wordpressBaseUrl =
  process.env.WORDPRESS_BASE_URL || "https://cms.redlinelandscapingky.com";
const wordpressUploadsHost = new URL(wordpressBaseUrl).hostname;

const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co").hostname;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
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
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
