import type { NextConfig } from "next";

const publicHost =
  process.env.NODE_ENV === 'development' && process.env.PUBLIC_APP_URL
    ? new URL(process.env.PUBLIC_APP_URL).hostname
    : undefined;
const tunnelHost =
  publicHost && !['localhost', '127.0.0.1', '[::1]'].includes(publicHost)
    ? publicHost
    : undefined;

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  ...(tunnelHost ? { allowedDevOrigins: [tunnelHost] } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb', // Permite vídeos de até 100MB
      ...(tunnelHost ? { allowedOrigins: [tunnelHost] } : {}),
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
