import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Daneswara Print - Percetakan Digital Bali',
  description: 'Percetakan digital Bali - stiker, banner, name tag, foto, dan lain-lain. Cepat, berkualitas, harga bersahabat.',
  metadataBase: new URL(process.env.PUBLIC_BASE_URL || 'https://daneswaraprint.com'),
  openGraph: { title: 'Daneswara Print', description: 'Percetakan Digital Bali', type: 'website' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
