/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  experimental: {
    // Tree-shake icon/barrel imports so unused exports don't ship to the client.
    optimizePackageImports: ['lucide-react'],
    // Cap build worker parallelism: on low-RAM dev machines, multiple
    // concurrent Jest workers can OOM mid-build ("Jest worker encountered
    // N child process exceptions"), silently dropping pages from the build.
    cpus: 1,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  },
  // Long-lived, immutable caching for static assets in /public (favicon, logos,
  // fonts). They are cache-busted via ?v= query params when they change.
  async headers() {
    return [
      {
        source: '/:all*(png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
