'use client';
import { useEffect } from 'react';

// Registers the service worker for PWA install + offline app shell.
// Only runs in production builds (dev has no stable asset URLs to cache).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration failures are non-fatal — the app still works online */
      });
    };

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
