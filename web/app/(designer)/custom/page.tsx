'use client';
import CustomTees from '@/src_pages/CustomTees';

// Desainer kaos untuk PELANGGAN UMUM - tanpa login.
// Komponennya sama dengan halaman admin /custom-tees, hanya dijalankan dengan
// `publicMode` sehingga panel pesanan admin dan badge jumlah pesanan baru
// disembunyikan. Semua endpoint yang dipakai memang publik:
//   POST /api/public/custom-tees/quote   (estimasi harga, tidak menulis data)
//   POST /api/public/custom-tees/drafts  (simpan desain saat "Cek Harga")
//   POST /api/public/custom-tees/orders  (kirim pesanan)
//   GET  /api/cliparts                   (pustaka clip art)
export default function Page() {
  return <CustomTees publicMode />;
}
