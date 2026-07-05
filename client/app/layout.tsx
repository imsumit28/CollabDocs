import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'CollabDocs',
  description: 'Write and edit documents together in real time with AI assistance.',
  verification: {
    google: '-vNmg7PuNLHFfWcYX4IJpq8A-ftDDTR1gFXWY5dvf5w',
  },
  icons: {
    icon: [
      { url: '/favicon.png?v=3', type: 'image/png', sizes: '256x256' },
    ],
    apple: '/favicon.png?v=3',
    shortcut: '/favicon.png?v=3',
  },
  appleWebApp: {
    capable: true,
    title: 'CollabDocs',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-[#F5F5F7] text-[#1D1D1F] antialiased">
        <ServiceWorkerRegister />
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
