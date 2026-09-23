/**
 * Font kustom untuk desainer kaos.
 * ---------------------------------------------------------------------------
 * Admin bisa mengunggah berkas font sendiri lewat panel "Teks" di
 * /custom-tees, lalu font itu langsung bisa dipilih pelanggan di /custom.
 *
 * Kenapa WOFF2 yang paling ideal: ukurannya paling kecil (kompresi Brotli,
 * rata-rata 30-50% lebih ringan dari TTF/OTF) sehingga desainer kaos lebih
 * cepat dibuka, dan sudah didukung semua browser modern.
 */

export const MAX_FONT_BYTES = 3 * 1024 * 1024; // 3MB

/**
 * Format yang diterima, diurutkan dari yang paling dianjurkan.
 * `css` = nilai untuk `format(...)` di dalam aturan @font-face.
 */
export const FONT_FORMATS = [
  {
    ext: 'woff2',
    css: 'woff2',
    mime: 'font/woff2',
    label: 'WOFF2',
    badge: 'Paling ideal',
    ideal: true,
    note: 'Paling ringan dan cepat dimuat. Format yang kami anjurkan.',
  },
  {
    ext: 'woff',
    css: 'woff',
    mime: 'font/woff',
    label: 'WOFF',
    badge: 'Bagus',
    ideal: false,
    note: 'Masih ringan, cocok sebagai cadangan untuk browser lama.',
  },
  {
    ext: 'ttf',
    css: 'truetype',
    mime: 'font/ttf',
    label: 'TTF',
    badge: 'Berat',
    ideal: false,
    note: 'Ukurannya besar karena tidak terkompresi. Sebaiknya diubah ke WOFF2 dulu.',
  },
  {
    ext: 'otf',
    css: 'opentype',
    mime: 'font/otf',
    label: 'OTF',
    badge: 'Berat',
    ideal: false,
    note: 'Ukurannya besar karena tidak terkompresi. Sebaiknya diubah ke WOFF2 dulu.',
  },
] as const;

export const ACCEPTED_FONT_EXTS = FONT_FORMATS.map((f) => f.ext);

export function fontFormatByExt(ext: string) {
  const e = String(ext || '').toLowerCase().replace(/^\./, '');
  return FONT_FORMATS.find((f) => f.ext === e) || null;
}

/** Ambil ekstensi dari nama berkas ("Bebas Neue.woff2" -> "woff2"). */
export function extFromFilename(filename: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(String(filename || '').trim());
  return m ? m[1].toLowerCase() : '';
}

/**
 * Nama CSS font-family yang aman dan pasti unik per tenant.
 * Contoh: "Bebas Neue!" -> "dnsw-bebas-neue".
 */
export function familyFromName(name: string): string {
  const base = String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `dnsw-${base || Date.now().toString(36)}`;
}

/** Ringkasan panduan yang ditampilkan di UI admin. */
export const FONT_GUIDE = {
  ideal: 'WOFF2',
  accepted: ACCEPTED_FONT_EXTS,
  max_bytes: MAX_FONT_BYTES,
  max_label: '3 MB',
  tips: [
    'WOFF2 adalah format paling ideal: ukurannya paling kecil dan cepat dimuat.',
    'TTF/OTF tetap bisa dipakai, tapi sebaiknya diubah dulu ke WOFF2.',
    'Satu berkas = satu ketebalan. Unggah terpisah untuk Regular dan Bold.',
    'Pakai font yang lisensinya mengizinkan penggunaan komersial.',
    'Cukup subset huruf Latin supaya berkasnya tetap ringan.',
  ],
};
