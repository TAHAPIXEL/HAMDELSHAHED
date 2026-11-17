import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite و pg باید در زمان اجرا از node_modules بارگذاری شوند.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // پیش‌نمایش در محیط‌های ابری و دامنه‌ی اصلی
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai", "*.vercel.app", "localhost", "127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
