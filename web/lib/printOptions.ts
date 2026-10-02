/**
 * Opsi printing + mockup + harga.
 *
 * SUMBER TUNGGAL yang dipakai bersama oleh:
 *   - /price-list              (components/landing/pages/PriceList.jsx)
 *   - katalog mobile           (lib/shopCatalogServer.ts)
 * Angkanya tidak diduplikasi: ubah di sini, kedua halaman ikut berubah.
 */

export interface PrintOption {
  id: string;
  label: string;
  price: number;
  mockup: string;
}

/** Tanpa printing: kaos polos, tidak ada biaya cetak. */
export const PLAIN_PRINT: PrintOption = {
  id: 'plain',
  label: 'Tanpa Printing',
  price: 0,
  mockup: '/mockups/depan.webp',
};

/** Paket printing satu sisi, sama dengan yang tampil di /price-list. */
export const PRINT_OPTIONS: PrintOption[] = [
  { id: 'logo', label: 'Logo', price: 10000, mockup: '/assets/mockups/logo-front.webp' },
  { id: 'a5', label: 'A5', price: 15000, mockup: '/assets/mockups/a5.webp' },
  { id: 'a4', label: 'A4', price: 25000, mockup: '/assets/mockups/a4.webp' },
  { id: 'a3', label: 'A3', price: 30000, mockup: '/assets/mockups/a3.webp' },
];

/** Daftar lengkap untuk pemilihan di detail produk mobile (Polos lebih dulu). */
export const PRINT_OPTIONS_WITH_PLAIN: PrintOption[] = [PLAIN_PRINT, ...PRINT_OPTIONS];

/** Mockup kombinasi dua sisi, dipakai /price-list. */
export const DOUBLE_PRINT_MOCKUPS: Record<string, string> = {
  'logo+logo': '/assets/mockups/logo-logo.webp',
  'a5+logo': '/assets/mockups/logo-a5.webp',
  'a4+logo': '/assets/mockups/logo-a4.webp',
  'a3+logo': '/assets/mockups/logo-a3.webp',
  'a5+a5': '/assets/mockups/a5-a5.webp',
  'a4+a5': '/assets/mockups/a5-a4.webp',
  'a3+a5': '/assets/mockups/a5-a3.webp',
  'a4+a4': '/assets/mockups/a4-a4.webp',
  'a3+a4': '/assets/mockups/a4-a3.webp',
  'a3+a3': '/assets/mockups/a3-a3.webp',
};

/** Diskon kalau mengambil dua sisi sekaligus. */
export const DOUBLE_PRINT_DISCOUNT = 5000;
