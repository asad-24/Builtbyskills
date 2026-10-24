import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.LMS_E2E === "1" ? ".next-lms-test" : ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
