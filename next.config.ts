import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uncomment để build static export cho shared hosting
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  /* config options here */
};

export default nextConfig;
