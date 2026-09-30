'use client';
import CustomSticker from '@/src_pages/CustomSticker';

// Editor Custom Sticker untuk PELANGGAN UMUM - tanpa login.
// Komponen sama dengan halaman admin /app/custom-sticker, hanya dijalankan
// dengan `publicMode` sehingga pesanan dikirim ke endpoint publik:
//   POST /api/public/sticker-orders
export default function Page() {
  return <CustomSticker publicMode />;
}
