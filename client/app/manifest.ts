import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CollabDocs',
    short_name: 'CollabDocs',
    description: 'Write and edit documents together in real time with AI assistance. Works offline.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F5F5F7',
    theme_color: '#2563EB',
    orientation: 'portrait-primary',
    icons: [
      // SVG scales to any size — satisfies installability on modern browsers
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/favicon.png', sizes: '104x104', type: 'image/png' },
      { src: '/logo.png', sizes: '242x212', type: 'image/png' },
    ],
  };
}
