import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chỉ bật static export khi build production
  ...(process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true'
    ? {
        output: 'export',
        trailingSlash: true,
      }
    : {}),
  images: {
    unoptimized: true,
  },
  // Giảm bundle size cho trình duyệt ví (SafePal, Binance): tree-shake ethers khi chỉ import một phần
  experimental: {
    optimizePackageImports: ['ethers'],
  },
};

export default nextConfig;
