import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Daneswara Print - Percetakan Digital Bali',
    template: '%s · Daneswara Print',
  },
  description: 'Percetakan digital Bali - stiker, banner, name tag, foto, dan lain-lain. Cepat, berkualitas, harga bersahabat.',
  metadataBase: new URL(process.env.PUBLIC_BASE_URL || 'https://daneswara.com'),
  applicationName: 'Daneswara Print',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/logo192.png', type: 'image/png', sizes: '192x192' },
      { url: '/logo512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: ['/favicon.ico'],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Daneswara Print - Percetakan Digital Bali',
    description: 'Percetakan Digital Bali - cepat, berkualitas, harga bersahabat.',
    url: '/',
    siteName: 'Daneswara Print',
    type: 'website',
    locale: 'id_ID',
    images: [{ url: '/logo512.png', width: 512, height: 512, alt: 'Daneswara Print' }],
  },
  twitter: {
    card: 'summary',
    title: 'Daneswara Print - Percetakan Digital Bali',
    description: 'Percetakan Digital Bali - cepat, berkualitas, harga bersahabat.',
    images: ['/logo512.png'],
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: '#ea580c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
