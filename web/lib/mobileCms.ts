/**
 * Mobile Platform Management — lapisan inti (CMS storefront versi HP).
 *
 * Catatan penting soal cakupan:
 *   Seluruh data fitur ini hidup di tabel BARU berawalan `mobile_cms_`. Tidak
 *   ada satu pun tabel/kolom existing (products, custom_products, orders, dst.)
 *   yang diubah, jadi POS, landing page, dan katalog mobile yang sekarang tetap
 *   berjalan apa adanya.
 *
 * Alur draft -> publish:
 *   Admin menyunting tabel `mobile_cms_*` (itulah "draft"). Tombol "Publish
 *   Changes" menulis SATU snapshot JSON ke `mobile_cms_layout.published`.
 *   Storefront HP pelanggan hanya membaca snapshot tersebut, sehingga draft
 *   yang belum dipublikasikan tidak pernah terlihat pelanggan.
 */
import { prisma } from './db';
import { safeJson, stringifyJson, toIso, badRequest } from './http';

/* ------------------------------------------------------------------ */
/* Konstanta                                                           */
/* ------------------------------------------------------------------ */

export const PRODUCT_STATUSES = ['active', 'draft', 'hidden', 'out_of_stock'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  draft: 'Draft',
  hidden: 'Hidden',
  out_of_stock: 'Out of Stock',
};

/** Status yang boleh tampil di storefront pelanggan. */
const VISIBLE_STATUSES = new Set(['active', 'out_of_stock']);

/** Urutan section bawaan halaman HP. Bisa diubah admin lewat Mobile Layout. */
export const DEFAULT_SECTIONS = [
  { key: 'header', label: 'Header', enabled: true, locked: true },
  { key: 'hero', label: 'Hero Banner', enabled: true, locked: false },
  { key: 'category', label: 'Category', enabled: true, locked: false },
  { key: 'featured', label: 'Featured Products', enabled: true, locked: false },
  { key: 'promo', label: 'Promo', enabled: true, locked: false },
  { key: 'products', label: 'All Products', enabled: true, locked: false },
  { key: 'custom_tees', label: 'Custom Tees', enabled: true, locked: false },
  { key: 'banner', label: 'Banner', enabled: true, locked: false },
  { key: 'footer', label: 'Footer', enabled: true, locked: true },
];

export const DEFAULT_SETTINGS = {
  /** Selama false, halaman HP pelanggan memakai tampilan lama (tanpa CMS). */
  storefront_enabled: false,
  store_name: 'Daneswara Print',
  tagline: 'Kaos, Stiker & Banner Custom',
  logo_url: '/assets/daneswara-logo.webp',
  theme_color: '#1d4ed8',
  search_placeholder: 'Cari produk cetak…',
  hero_image: '',
  hero_title: '',
  hero_subtitle: '',
  hero_cta_label: 'Lihat Produk',
  hero_cta_href: '/belanja',
  category_title: 'Kategori',
  featured_title: 'Produk Pilihan',
  featured_limit: 4,
  promo_image: '',
  promo_title: '',
  promo_subtitle: '',
  promo_href: '',
  products_title: 'Semua Produk',
  custom_tees_title: 'Desain Kaos Sendiri',
  custom_tees_subtitle: 'Upload desainmu, lihat mockup langsung.',
  custom_tees_href: '/custom-tees',
  banner_image: '',
  banner_href: '',
  whatsapp: '',
  footer_note: 'Harga final dikonfirmasi CS setelah desain diperiksa.',
};

export type MobileCmsSettings = typeof DEFAULT_SETTINGS & Record<string, any>;

/* ------------------------------------------------------------------ */
/* Pengaman skema (aditif & idempotent, sama pola dengan schemaGuard) */
/* ------------------------------------------------------------------ */

function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    if (!p) {
      p = fn().catch((e) => {
        p = null;
        throw e;
      });
    }
    return p;
  };
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
  `;
  return Number(rows?.[0]?.n || 0) > 0;
}

export const ensureMobileCmsSchema = once(async () => {
  if (!(await tableExists('mobile_cms_products'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`mobile_cms_products\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`tenant_id\` VARCHAR(36) NOT NULL,
        \`name\` VARCHAR(200) NOT NULL,
        \`slug\` VARCHAR(200) NOT NULL,
        \`category_id\` VARCHAR(36) NULL,
        \`description\` TEXT NULL,
        \`sku\` VARCHAR(100) NULL,
        \`price\` FLOAT NOT NULL DEFAULT 0,
        \`cost\` FLOAT NOT NULL DEFAULT 0,
        \`compare_price\` FLOAT NOT NULL DEFAULT 0,
        \`discount\` FLOAT NOT NULL DEFAULT 0,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'draft',
        \`is_featured\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`variants\` TEXT NULL,
        \`images\` TEXT NULL,
        \`main_image\` TEXT NULL,
        \`thumbnail_image\` TEXT NULL,
        \`banner_image\` TEXT NULL,
        \`sort_order\` INTEGER NOT NULL DEFAULT 0,
        \`deleted_at\` DATETIME(0) NULL,
        \`created_at\` DATETIME(0) NOT NULL,
        \`updated_at\` DATETIME(0) NOT NULL,
        INDEX \`ix_mobile_cms_products_tenant_id\`(\`tenant_id\`),
        INDEX \`ix_mobile_cms_products_sort\`(\`tenant_id\`, \`sort_order\`),
        INDEX \`ix_mobile_cms_products_status\`(\`tenant_id\`, \`status\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('[schema] tabel mobile_cms_products dibuat');
  }

  if (!(await tableExists('mobile_cms_categories'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`mobile_cms_categories\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`tenant_id\` VARCHAR(36) NOT NULL,
        \`name\` VARCHAR(160) NOT NULL,
        \`image\` TEXT NULL,
        \`sort_order\` INTEGER NOT NULL DEFAULT 0,
        \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`deleted_at\` DATETIME(0) NULL,
        \`created_at\` DATETIME(0) NOT NULL,
        \`updated_at\` DATETIME(0) NOT NULL,
        INDEX \`ix_mobile_cms_categories_tenant_id\`(\`tenant_id\`),
        INDEX \`ix_mobile_cms_categories_sort\`(\`tenant_id\`, \`sort_order\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('[schema] tabel mobile_cms_categories dibuat');
  }

  if (!(await tableExists('mobile_cms_media'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`mobile_cms_media\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`tenant_id\` VARCHAR(36) NOT NULL,
        \`url\` TEXT NOT NULL,
        \`label\` VARCHAR(200) NOT NULL DEFAULT '',
        \`width\` INTEGER NOT NULL DEFAULT 0,
        \`height\` INTEGER NOT NULL DEFAULT 0,
        \`sort_order\` INTEGER NOT NULL DEFAULT 0,
        \`created_at\` DATETIME(0) NOT NULL,
        INDEX \`ix_mobile_cms_media_tenant_id\`(\`tenant_id\`),
        INDEX \`ix_mobile_cms_media_sort\`(\`tenant_id\`, \`sort_order\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('[schema] tabel mobile_cms_media dibuat');
  }

  if (!(await tableExists('mobile_cms_layout'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`mobile_cms_layout\` (
        \`tenant_id\` VARCHAR(36) NOT NULL,
        \`sections\` TEXT NULL,
        \`settings\` TEXT NULL,
        \`published\` LONGTEXT NULL,
        \`published_at\` DATETIME(0) NULL,
        \`updated_at\` DATETIME(0) NOT NULL,
        PRIMARY KEY (\`tenant_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('[schema] tabel mobile_cms_layout dibuat');
  }
});

/* ------------------------------------------------------------------ */
/* Perhitungan harga                                                   */
/* ------------------------------------------------------------------ */

/** Profit & margin satu produk. Margin = profit / harga jual x 100. */
export function profitOf(price: number, cost: number) {
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  const profit = p - c;
  const margin = p > 0 ? (profit / p) * 100 : 0;
  return { profit, margin: Math.round(margin * 10) / 10 };
}

export function slugify(name: string): string {  return (
    String(name || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'produk'
  );
}

/* ------------------------------------------------------------------ */
/* Payload produk (dipakai POST & PUT)                                 */
/* ------------------------------------------------------------------ */

function cleanVariants(raw: any) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((v: any) => ({
      size: String(v?.size || '').slice(0, 40),
      color: String(v?.color || '').slice(0, 40),
      stock: Math.max(0, Math.floor(Number(v?.stock) || 0)),
    }))
    .filter((v) => v.size || v.color);
}

function cleanImages(raw: any) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((u: any) => String(u || ''))
    .filter(Boolean)
    .slice(0, 20);
}

/** Bersihkan & validasi body produk dari admin. */
export function productPayload(body: any) {
  const name = String(body?.name || '').trim();
  if (!name) badRequest('Nama produk wajib diisi');
  const status = (PRODUCT_STATUSES as readonly string[]).includes(body?.status)
    ? body.status
    : 'draft';
  const images = cleanImages(body?.images);
  const main = String(body?.main_image || '') || images[0] || '';
  return {
    name: name.slice(0, 200),
    slug: slugify(body?.slug || name),
    category_id: String(body?.category_id || '') || null,
    description: String(body?.description || '').slice(0, 4000),
    sku: String(body?.sku || '').slice(0, 100),
    price: Math.max(0, Number(body?.price) || 0),
    cost: Math.max(0, Number(body?.cost) || 0),
    compare_price: Math.max(0, Number(body?.compare_price) || 0),
    discount: Math.max(0, Number(body?.discount) || 0),
    status,
    is_featured: !!body?.is_featured,
    variants: stringifyJson(cleanVariants(body?.variants)),
    images: stringifyJson(images),
    main_image: main,
    thumbnail_image: String(body?.thumbnail_image || '') || main,
    banner_image: String(body?.banner_image || ''),
  };
}

/* ------------------------------------------------------------------ */
/* Serializer                                                          */
/* ------------------------------------------------------------------ */

export function serializeCmsProduct(row: any) {
  const images: string[] = safeJson<string[]>(row.images, []) || [];
  const variants = safeJson<any[]>(row.variants, []) || [];
  const price = Number(row.price) || 0;
  const cost = Number(row.cost) || 0;
  const { profit, margin } = profitOf(price, cost);
  const main = row.main_image || images[0] || '';
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category_id: row.category_id || '',
    description: row.description || '',
    sku: row.sku || '',
    price,
    cost,
    compare_price: Number(row.compare_price) || 0,
    discount: Number(row.discount) || 0,
    status: row.status || 'draft',
    status_label: STATUS_LABEL[row.status] || row.status,
    is_featured: !!row.is_featured,
    variants: Array.isArray(variants) ? variants : [],
    images,
    main_image: main,
    thumbnail_image: row.thumbnail_image || main,
    banner_image: row.banner_image || '',
    sort_order: Number(row.sort_order) || 0,
    profit,
    margin,
    stock_total: (Array.isArray(variants) ? variants : []).reduce(
      (s: number, v: any) => s + (Number(v?.stock) || 0),
      0,
    ),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export function serializeCmsCategory(row: any) {
  return {
    id: row.id,
    name: row.name,
    image: row.image || '',
    sort_order: Number(row.sort_order) || 0,
    is_active: !!row.is_active,
    created_at: toIso(row.created_at),
  };
}

export function serializeCmsMedia(row: any) {
  return {
    id: row.id,
    url: row.url,
    label: row.label || '',
    width: Number(row.width) || 0,
    height: Number(row.height) || 0,
    sort_order: Number(row.sort_order) || 0,
    created_at: toIso(row.created_at),
  };
}

/* ------------------------------------------------------------------ */
/* Layout / settings (draft)                                           */
/* ------------------------------------------------------------------ */

/** Gabungkan daftar section tersimpan dengan bawaan supaya tetap lengkap. */
export function normalizeSections(raw: any) {
  const saved: any[] = Array.isArray(raw) ? raw : [];
  const out: any[] = [];
  const seen = new Set<string>();
  for (const s of saved) {
    const base = DEFAULT_SECTIONS.find((d) => d.key === s?.key);
    if (!base || seen.has(base.key)) continue;
    seen.add(base.key);
    out.push({ ...base, enabled: base.locked ? true : s.enabled !== false });
  }
  // Section baru (hasil update aplikasi) ditambahkan di posisi bawaannya.
  DEFAULT_SECTIONS.forEach((d, i) => {
    if (seen.has(d.key)) return;
    out.splice(Math.min(i, out.length), 0, { ...d });
  });
  return out;
}

export function normalizeSettings(raw: any): MobileCmsSettings {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const out: any = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  }
  out.storefront_enabled = !!out.storefront_enabled;
  out.featured_limit = Math.max(1, Math.min(24, Number(out.featured_limit) || 4));
  return out;
}

export async function getLayoutRow(tenantId: string) {
  const row = await prisma.mobile_cms_layout.findUnique({ where: { tenant_id: tenantId } });
  if (row) return row;
  return await prisma.mobile_cms_layout.create({
    data: {
      tenant_id: tenantId,
      sections: stringifyJson(DEFAULT_SECTIONS),
      settings: stringifyJson(DEFAULT_SETTINGS),
      published: null,
      published_at: null,
      updated_at: new Date(),
    },
  });
}

export async function getDraft(tenantId: string) {
  const row = await getLayoutRow(tenantId);
  const [products, categories, media] = await Promise.all([
    prisma.mobile_cms_products.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    }),
    prisma.mobile_cms_categories.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    }),
    prisma.mobile_cms_media.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
    }),
  ]);
  return {
    sections: normalizeSections(safeJson<any[]>(row.sections, DEFAULT_SECTIONS)),
    settings: normalizeSettings(safeJson<any>(row.settings, DEFAULT_SETTINGS)),
    products: products.map(serializeCmsProduct),
    categories: categories.map(serializeCmsCategory),
    media: media.map(serializeCmsMedia),
    published_at: toIso(row.published_at),
    has_published: !!row.published,
  };
}

/* ------------------------------------------------------------------ */
/* Snapshot publish                                                    */
/* ------------------------------------------------------------------ */

/** Bentuk ringan yang dibaca storefront HP (hanya yang layak tampil). */
export function buildSnapshot(draft: Awaited<ReturnType<typeof getDraft>>) {
  const catById = new Map(draft.categories.map((c) => [c.id, c]));
  const products = draft.products
    .filter((p) => VISIBLE_STATUSES.has(p.status))
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      sku: p.sku,
      price: p.price,
      compare_price: p.compare_price,
      discount: p.discount,
      status: p.status,
      is_featured: p.is_featured,
      category_id: p.category_id,
      category_name: catById.get(p.category_id)?.name || '',
      main_image: p.main_image,
      thumbnail_image: p.thumbnail_image,
      banner_image: p.banner_image,
      images: p.images,
      variants: p.variants,
      stock_total: p.stock_total,
      sort_order: p.sort_order,
    }));
  return {
    enabled: !!draft.settings.storefront_enabled,
    settings: draft.settings,
    sections: draft.sections.filter((s) => s.enabled !== false),
    categories: draft.categories.filter((c) => c.is_active),
    products,
    published_at: new Date().toISOString(),
  };
}

export async function publishSnapshot(tenantId: string) {
  await getLayoutRow(tenantId);
  const draft = await getDraft(tenantId);
  const snapshot = buildSnapshot(draft);
  const now = new Date();
  await prisma.mobile_cms_layout.update({
    where: { tenant_id: tenantId },
    data: { published: stringifyJson(snapshot), published_at: now, updated_at: now },
  });
  return snapshot;
}

/** Snapshot yang sedang dilihat pelanggan. Null kalau belum pernah publish. */
export async function readPublished(tenantId: string) {
  const row = await prisma.mobile_cms_layout.findUnique({ where: { tenant_id: tenantId } });
  if (!row?.published) return null;
  return safeJson<any>(row.published, null);
}

/**
 * Versi tanpa tenant untuk halaman publik (instalasi ini satu tenant, pola yang
 * sama dipakai /api/public/brand). Aman kalau tabelnya belum ada: kembalikan
 * null supaya storefront jatuh ke tampilan lama.
 */
export async function readPublishedPublic() {
  try {
    const row = await prisma.mobile_cms_layout.findFirst({
      where: { NOT: { published: null } },
      orderBy: { tenant_id: 'asc' },
    });
    if (!row?.published) return null;
    return safeJson<any>(row.published, null);
  } catch {
    return null;
  }
}
