import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chỉ bật static export khi build production
  // Trong development, tắt để hỗ trợ dynamic routes
  ...(process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true'
    ? {
        output: 'export',
        trailingSlash: true,
      }
    : {}),
  images: {
    unoptimized: true,
  },
  /* config options here */
};

export default nextConfig;
