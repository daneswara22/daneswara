/** @type {import('next').NextConfig} */
const path = require('path');
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.daneswara.com' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/App.css': path.resolve(__dirname, 'app/App.css'),
      '@/landing': path.resolve(__dirname, 'components/landing'),
      '@/pages': path.resolve(__dirname, 'src_pages'),
      '@/components': path.resolve(__dirname, 'components'),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/context': path.resolve(__dirname, 'context'),
      '@/hooks': path.resolve(__dirname, 'hooks'),
      '@/constants': path.resolve(__dirname, 'constants'),
      '@': path.resolve(__dirname),
      // Replace react-router-dom with our Next.js compat shim so ported CRA pages work as-is.
      'react-router-dom': path.resolve(__dirname, 'lib/react-router-shim.tsx'),
    };
    return config;
  },
  async redirects() {
    return [
      { source: '/admin', destination: '/login', permanent: false },
      { source: '/produk', destination: '/app/produk', permanent: false },
      { source: '/kategori', destination: '/app/kategori', permanent: false },
      { source: '/inventory', destination: '/app/inventory', permanent: false },
      { source: '/pelanggan', destination: '/app/pelanggan', permanent: false },
      { source: '/pesanan', destination: '/app/pesanan', permanent: false },
      { source: '/riwayat', destination: '/app/riwayat', permanent: false },
      { source: '/supplier', destination: '/app/supplier', permanent: false },
      { source: '/pembelian', destination: '/app/pembelian', permanent: false },
      { source: '/pengeluaran', destination: '/app/pengeluaran', permanent: false },
      { source: '/pendapatan-lain', destination: '/app/pendapatan-lain', permanent: false },
      { source: '/laporan', destination: '/app/laporan', permanent: false },
      { source: '/ekspor', destination: '/app/ekspor', permanent: false },
      { source: '/pengguna', destination: '/app/pengguna', permanent: false },
      { source: '/pengaturan', destination: '/app/pengaturan', permanent: false },
    ];
  },
};
module.exports = nextConfig;
