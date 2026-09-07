// Sumber dana yang dipakai untuk pemasukan dan pengeluaran keuangan.
// Nilai daftarnya sengaja disamakan dengan metode pembayaran POS (lib/schemas.ts PAYMENT_METHODS)
// agar Laporan Arus Kas bisa dijumlahkan silang antara penjualan, pengeluaran, dan pendapatan lain.
export const FUND_SOURCES = [
  'Tunai',
  'BCA TOKO',
  'BRI TOKO',
  'BCA ADMIN (ELIS)',
  'QRIS',
  'E-Wallet',
];
