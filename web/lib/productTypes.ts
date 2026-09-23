/**
 * Jenis Produk (custom tee) — helper bersama.
 * ---------------------------------------------------------------------------
 * Dipakai oleh:
 *   - /api/custom-products*        (CRUD admin, halaman /app/jenis-produk)
 *   - /api/public/custom-products  (konsumsi /price-list dan /custom)
 *
 * Satu jenis produk = satu baris `custom_products` + banyak `custom_product_colors`
 * (varian warna + thumbnail tampak depan) + banyak `custom_product_sizes`
 * (size chart: lebar dada & panjang dalam cm).
 */

export const SIZE_REGIONS = ['Asia / Local Size', 'Eropa / USA'] as const;

/** Urutan ukuran standar dipakai sebagai fallback pengurutan size chart. */
export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

export function sizeRank(label: string): number {
  const i = SIZE_ORDER.indexOf(String(label || '').toUpperCase());
  return i === -1 ? 999 : i;
}

/** Ubah nama produk menjadi slug aman untuk `product_key`. */
export function slugifyProductKey(input: string): string {
  const base = String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return base || `produk-${Date.now().toString(36)}`;
}

/**
 * Tiga jenis kaos awal (sesuai daftar harga lama yang sebelumnya hardcoded di
 * `components/landing/pages/PriceList.jsx`). Dipakai untuk seeding pertama kali
 * supaya halaman publik tidak pernah kosong sebelum admin mengisi data.
 */
export const PRODUCT_TYPE_SEEDS = [
  {
    // Baris ini sudah ada sejak fitur Custom Tees (dipakai /custom). Seeding di
    // bawah hanya melengkapi kolom info yang baru, tidak menimpa judul/deskripsi.
    product_key: 'premium-cotton-7200',
    title: 'New States Apparel Premium Cotton T-shirt 7200',
    subtitle: 'Kaos premium ring-spun cotton',
    price: 70000,
    supplier: 'New States Apparel',
    size_region: 'Eropa / USA',
    model: 'Regular fit, tubular construction',
    material: '100% cotton ring spun preshrunk jersey 180g/m\u00b2',
    description:
      'Made from lightweight ring-spun cotton, this t-shirt offers a noticeably softer and more ' +
      'comfortable feel. It features a regular fit that sits nicely without feeling tight.',
    sort_order: 5,
    colors: [
      { name: 'Putih', hex: '#FFFFFF' },
      { name: 'Hitam', hex: '#111111' },
      { name: 'Abu Muda', hex: '#CBD0D6' },
      { name: 'Navy', hex: '#2B3A67' },
      { name: 'Maroon', hex: '#5B1F1F' },
      { name: 'Hijau Daun', hex: '#27AE60' },
      { name: 'Kuning', hex: '#F1C40F' },
      { name: 'Baby Pink', hex: '#F4B8CF' },
    ],
    size_chart: [
      { label: 'S', chest_cm: 46, length_cm: 69 },
      { label: 'M', chest_cm: 51, length_cm: 72 },
      { label: 'L', chest_cm: 56, length_cm: 74 },
      { label: 'XL', chest_cm: 61, length_cm: 77 },
      { label: '2XL', chest_cm: 66, length_cm: 79 },
      { label: '3XL', chest_cm: 71, length_cm: 82 },
      { label: '4XL', chest_cm: 76, length_cm: 84 },
      { label: '5XL', chest_cm: 81, length_cm: 87 },
    ],
  },
  {
    product_key: 'size-local-buildup-tees',
    title: 'SIZE LOCAL (BuildUp Tees)',
    subtitle: 'Kaos 24s dengan ukuran lokal',
    price: 55000,
    supplier: 'New State Apparel 24s Premium',
    size_region: 'Asia / Local Size',
    model: 'Kaos tanpa jaritan samping',
    material: 'Cotton 100% 24s',
    description:
      'Kaos build-up dengan potongan ukuran lokal (Asia). Bahan cotton combed 24s yang adem, ' +
      'jatuh rapi di badan, dan tahan dipakai harian. Cocok untuk kaos komunitas, seragam, maupun merch band.',
    sort_order: 10,
    colors: [
      { name: 'Putih', hex: '#FFFFFF' },
      { name: 'Hitam', hex: '#111111' },
      { name: 'Navy', hex: '#2B3A67' },
      { name: 'Abu Muda', hex: '#CBD0D6' },
      { name: 'Maroon', hex: '#5B1F1F' },
      { name: 'Hijau Tua', hex: '#2E7D32' },
    ],
    size_chart: [
      { label: 'S', chest_cm: 46, length_cm: 66 },
      { label: 'M', chest_cm: 49, length_cm: 69 },
      { label: 'L', chest_cm: 52, length_cm: 72 },
      { label: 'XL', chest_cm: 55, length_cm: 74 },
      { label: '2XL', chest_cm: 58, length_cm: 76 },
      { label: '3XL', chest_cm: 61, length_cm: 78 },
    ],
  },
  {
    product_key: 'size-luar-buildup-tees',
    title: 'SIZE LUAR (BuildUp Tees)',
    subtitle: 'Potongan ukuran Eropa / USA',
    price: 60000,
    supplier: 'Stich Premium 24s',
    size_region: 'Eropa / USA',
    model: 'Kaos tanpa jaritan samping',
    material: 'Cotton 100% 24s',
    description:
      'Versi ukuran internasional (Eropa/USA) sehingga badan dan panjangnya lebih besar satu tingkat ' +
      'dibanding ukuran lokal. Pilihan favorit untuk gaya oversize dan pesanan ekspor.',
    sort_order: 20,
    colors: [
      { name: 'Putih', hex: '#FFFFFF' },
      { name: 'Hitam', hex: '#111111' },
      { name: 'Krem', hex: '#D8C3A5' },
      { name: 'Olive', hex: '#7A7A2E' },
      { name: 'Biru Royal', hex: '#1F3FAE' },
    ],
    size_chart: [
      { label: 'S', chest_cm: 48, length_cm: 68 },
      { label: 'M', chest_cm: 51, length_cm: 71 },
      { label: 'L', chest_cm: 54, length_cm: 74 },
      { label: 'XL', chest_cm: 57, length_cm: 76 },
      { label: '2XL', chest_cm: 60, length_cm: 78 },
    ],
  },
  {
    product_key: 'standar-dns',
    title: 'Standar DNS',
    subtitle: 'Produk original Daneswara Printing',
    price: 50000,
    supplier: 'Produk Original dari DANESWARA PRINTING',
    size_region: 'Asia / Local Size',
    model: 'Kaos Reguler dengan jaritan samping',
    material: 'Cotton 100% 30s (Nirwana Textile) softees',
    description:
      'Kaos reguler produksi sendiri memakai cotton 30s softees yang lebih ringan dan lembut. ' +
      'Paling ekonomis untuk pesanan jumlah banyak tanpa mengorbankan kenyamanan.',
    sort_order: 30,
    colors: [
      { name: 'Putih', hex: '#FFFFFF' },
      { name: 'Hitam', hex: '#111111' },
      { name: 'Merah', hex: '#C0392B' },
      { name: 'Kuning', hex: '#F1C40F' },
      { name: 'Baby Blue', hex: '#8EC7F0' },
      { name: 'Ungu', hex: '#7D3CC9' },
      { name: 'Tosca', hex: '#2EA67A' },
    ],
    size_chart: [
      { label: 'S', chest_cm: 45, length_cm: 65 },
      { label: 'M', chest_cm: 48, length_cm: 68 },
      { label: 'L', chest_cm: 51, length_cm: 71 },
      { label: 'XL', chest_cm: 54, length_cm: 73 },
      { label: '2XL', chest_cm: 57, length_cm: 75 },
    ],
  },
];
