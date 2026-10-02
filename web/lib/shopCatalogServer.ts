/**
 * Katalog produk untuk tampilan MOBILE, disusun dari DATABASE.
 *
 * Sumber harga (tidak ada angka produk yang ditulis di file ini):
 *   - kaos/produk custom -> tabel `custom_products` (dikelola di /app/jenis-produk)
 *   - biaya printing      -> baris `custom_products` dengan category = 'printing'
 *   - stiker              -> lib/stickerPricing.ts (STICKER_MATERIALS), konstanta
 *                            yang sama dipakai server saat memproses pesanan
 */
import { listProductTypes } from '@/lib/productTypeQueries';
import {
  STICKER_MATERIALS,
  STICKER_BULK_MIN,
  STICKER_BULK_DISCOUNT,
} from '@/lib/stickerPricing';
import {
  PRINT_OPTIONS_WITH_PLAIN,
  DOUBLE_PRINT_MOCKUPS,
  DOUBLE_PRINT_DISCOUNT,
} from '@/lib/printOptions';

const PRINTING_CATEGORY = 'printing';
const FALLBACK_THUMB = '/assets/mockups/logo-a4.webp';
const STICKER_THUMB: Record<string, string> = {
  BONTAX: '/stickers/bontax.jpg',
  VINYL: '/stickers/vinyl.jpg',
};

/**
 * Opsi printing bawaan = data yang sama dengan halaman /price-list
 * (lib/printOptions.ts), termasuk mockup dan harganya. Tidak ada angka yang
 * diduplikasi di sini. Kalau admin membuat jenis produk ber-category
 * 'printing', daftar dari database yang dipakai.
 */
const DEFAULT_PRINTS = PRINT_OPTIONS_WITH_PLAIN.map((o) => ({
  id: o.id,
  v: o.label,
  add: o.price,
  thumb: o.mockup,
}));

export interface ShopProduct {
  slug: string;
  kind: 'tee' | 'sticker' | 'link';
  name: string;
  desc: string;
  base: number;
  thumb: string;
  gallery: string[];
  unitLabel: string;
  upload: boolean;
  uploadLabel?: string;
  bulkNote?: string;
  material?: string;
  productKey?: string;
  productTitle?: string;
  href?: string;
  prints?: { id: string; v: string; add: number; thumb?: string }[];
  /** Diskon kalau pelanggan mencetak depan + belakang sekaligus. */
  doubleDiscount?: number;
  /** Mockup kombinasi dua sisi, kunci dari pairKey(idDepan, idBelakang). */
  pairMockups?: Record<string, string>;
  sizes?: { v: string; add: number }[];
  colors?: { v: string; hex: string }[];
  bulkMin?: number;
  bulkDiscount?: number;
}

export async function buildShopCatalog(): Promise<ShopProduct[]> {
  const { items } = await listProductTypes({ page: 1, limit: 50, activeOnly: true });

  const printingRows = items.filter(
    (p: any) => String(p.category || '').trim().toLowerCase() === PRINTING_CATEGORY,
  );
  const prints = printingRows.length
    ? printingRows.map((p: any) => ({
        id: p.product_key,
        v: p.title,
        add: Number(p.price) || 0,
        thumb: p.thumbnail_url || (p.colors || []).find((c: any) => c.thumb_url)?.thumb_url || '',
      }))
    : DEFAULT_PRINTS;

  const tees: ShopProduct[] = items
    .filter((p: any) => String(p.category || '').trim().toLowerCase() !== PRINTING_CATEGORY)
    .map((p: any) => {
      const colors = (p.colors || [])
        .filter((c: any) => c.is_active)
        .map((c: any) => ({ v: c.name, hex: c.hex }));
      const colorThumb = (p.colors || []).find((c: any) => c.thumb_url)?.thumb_url || '';
      const thumb = p.thumbnail_url || colorThumb || FALLBACK_THUMB;
      return {
        slug: p.product_key,
        kind: 'tee' as const,
        name: p.title,
        desc: p.subtitle || p.description || '',
        base: Number(p.price) || 0,
        thumb,
        gallery: [thumb],
        unitLabel: 'pcs',
        upload: true,
        uploadLabel: 'Upload desain (logo / gambar)',
        productKey: p.product_key,
        productTitle: p.title,
        prints,
        doubleDiscount: DOUBLE_PRINT_DISCOUNT,
        pairMockups: DOUBLE_PRINT_MOCKUPS,
        sizes: (p.size_chart || []).map((s: any) => ({ v: s.label, add: 0 })),
        colors: colors.length ? colors : undefined,
      };
    });

  const stickers: ShopProduct[] = STICKER_MATERIALS.map((m) => ({
    slug: `sticker-${m.value.toLowerCase()}`,
    kind: 'sticker' as const,
    material: m.value,
    name: `Stiker ${m.label} + Cutting`,
    desc: 'Print + cutting setengah putus. Ukuran lembar 28 × 43 cm.',
    base: m.price,
    thumb: STICKER_THUMB[m.value] || FALLBACK_THUMB,
    gallery: [STICKER_THUMB[m.value] || FALLBACK_THUMB],
    unitLabel: 'lembar',
    upload: true,
    uploadLabel: 'Upload desain stiker',
    bulkNote: `Ambil ${STICKER_BULK_MIN} lembar atau lebih: potong Rp${STICKER_BULK_DISCOUNT.toLocaleString('id-ID')} per lembar.`,
    bulkMin: STICKER_BULK_MIN,
    bulkDiscount: STICKER_BULK_DISCOUNT,
  }));

  // Pintasan ke editor penuh yang sudah ada. Harga diambil dari data di atas.
  const cheapestTee = tees.length ? Math.min(...tees.map((t) => t.base)) : 0;
  const links: ShopProduct[] = [
    {
      slug: 'custom-kaos',
      kind: 'link',
      name: 'Custom Kaos (Editor)',
      desc: 'Rancang sendiri depan, belakang, dan lengan di editor desain kami.',
      base: cheapestTee,
      thumb: '/assets/daneswara-custom-editor.webp',
      gallery: [],
      unitLabel: 'pcs',
      upload: false,
      href: '/custom',
    },
    {
      slug: 'custom-stiker',
      kind: 'link',
      name: 'Stiker Custom (Editor)',
      desc: 'Atur bentuk dan ukuran stiker sendiri di kanvas 28 × 43 cm.',
      base: stickers.length ? Math.min(...stickers.map((s) => s.base)) : 0,
      thumb: '/stickers/custom.jpg',
      gallery: [],
      unitLabel: 'lembar',
      upload: false,
      href: '/custom-sticker',
    },
  ];

  return [...tees, ...stickers, ...links];
}
