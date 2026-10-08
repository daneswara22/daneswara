/**
 * Katalog gambar gabungan: GET /api/mobile-cms/media/all
 *
 * Mengumpulkan SEMUA URL gambar yang tersimpan di database tenant, bukan hanya
 * yang tercatat di tab Media. Dipakai tombol "Media" pada ImagePicker supaya
 * admin bisa memakai ulang gambar apa pun yang sudah pernah dipasang di mana
 * saja, tanpa harus mengunggah ulang.
 *
 * Hanya membaca. Tidak ada tabel baru, tidak ada perubahan skema.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { ensureMobileCmsSchema } from '@/lib/mobileCms';
import { safeJson } from '@/lib/http';

const ROLES = ['Owner', 'Manager'] as const;

/** Urutan kelompok mengikuti seberapa sering gambarnya dipakai ulang. */
const SOURCES = [
  { key: 'media', label: 'Media' },
  { key: 'app_product', label: 'Produk App' },
  { key: 'app_category', label: 'Kategori App' },
  { key: 'pos_product', label: 'Produk POS' },
  { key: 'pos_category', label: 'Kategori POS' },
  { key: 'gallery', label: 'Galeri Website' },
  { key: 'product_type', label: 'Jenis Produk' },
  { key: 'product_color', label: 'Warna Produk' },
  { key: 'mockup', label: 'Mockup Custom' },
  { key: 'branding', label: 'Logo & Branding' },
] as const;

type Item = { id: string; url: string; label: string; source: string; source_label: string };

/** Hanya terima URL gambar yang bisa dirender browser. */
function isImageUrl(raw: unknown): raw is string {
  const url = String(raw ?? '').trim();
  if (!url) return false;
  if (url.startsWith('data:')) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
}

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const tenant = { tenant_id: user.tenant_id };

  const [media, appProducts, appCategories, posProducts, posCategories, gallery, types, colors, mockups, settings] =
    await Promise.all([
      prisma.mobile_cms_media.findMany({
        where: tenant,
        orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
        select: { id: true, url: true, label: true },
      }),
      prisma.mobile_cms_products.findMany({
        where: tenant,
        orderBy: { created_at: 'desc' },
        select: { id: true, name: true, images: true, main_image: true, thumbnail_image: true, banner_image: true },
      }),
      prisma.mobile_cms_categories.findMany({
        where: tenant,
        orderBy: { sort_order: 'asc' },
        select: { id: true, name: true, image: true },
      }),
      prisma.products.findMany({
        where: { ...tenant, image: { not: null } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, image: true },
      }),
      prisma.categories.findMany({
        where: { ...tenant, image: { not: null } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, image: true },
      }),
      prisma.gallery_items.findMany({
        where: tenant,
        orderBy: { sort_order: 'asc' },
        select: { id: true, label: true, src: true },
      }),
      prisma.custom_products.findMany({
        where: { ...tenant, deleted_at: null },
        orderBy: { sort_order: 'asc' },
        select: { id: true, title: true, thumbnail_url: true, size_guide_url: true },
      }),
      prisma.custom_product_colors.findMany({
        where: tenant,
        orderBy: { sort_order: 'asc' },
        select: { id: true, name: true, thumb_url: true },
      }),
      prisma.custom_mockups.findMany({
        where: tenant,
        orderBy: { created_at: 'desc' },
        select: { id: true, product_key: true, color_hex: true, view: true, image_url: true },
      }),
      prisma.settings.findFirst({ where: tenant, select: { logo: true } }),
    ]);

  const items: Item[] = [];
  const seen = new Set<string>();
  const labelOf = (key: string) => SOURCES.find((s) => s.key === key)?.label || key;

  /** URL yang sama hanya muncul sekali, memakai sumber yang pertama ditemukan. */
  const push = (url: unknown, label: string, source: string, id: string) => {
    if (!isImageUrl(url)) return;
    const clean = String(url).trim();
    if (seen.has(clean)) return;
    seen.add(clean);
    items.push({
      id: `${source}:${id}:${items.length}`,
      url: clean,
      label: label || 'Tanpa nama',
      source,
      source_label: labelOf(source),
    });
  };

  media.forEach((m) => push(m.url, m.label, 'media', m.id));

  appProducts.forEach((p) => {
    push(p.main_image, p.name, 'app_product', p.id);
    push(p.thumbnail_image, `${p.name} - thumbnail`, 'app_product', p.id);
    push(p.banner_image, `${p.name} - banner`, 'app_product', p.id);
    (safeJson<string[]>(p.images, []) || []).forEach((u) => push(u, p.name, 'app_product', p.id));
  });

  appCategories.forEach((c) => push(c.image, c.name, 'app_category', c.id));
  posProducts.forEach((p) => push(p.image, p.name, 'pos_product', p.id));
  posCategories.forEach((c) => push(c.image, c.name, 'pos_category', c.id));
  gallery.forEach((g) => push(g.src, g.label, 'gallery', g.id));

  types.forEach((t) => {
    push(t.thumbnail_url, t.title, 'product_type', t.id);
    push(t.size_guide_url, `${t.title} - panduan ukuran`, 'product_type', t.id);
  });

  colors.forEach((c) => push(c.thumb_url, c.name, 'product_color', c.id));
  mockups.forEach((m) =>
    push(m.image_url, `${m.product_key} ${m.color_hex} ${m.view}`.trim(), 'mockup', m.id),
  );
  if (settings) push(settings.logo, 'Logo usaha', 'branding', 'logo');

  // Hanya kirim kelompok yang benar-benar punya gambar, supaya filter tetap ringkas.
  const counts = new Map<string, number>();
  items.forEach((it) => counts.set(it.source, (counts.get(it.source) || 0) + 1));
  const sources = SOURCES.filter((s) => counts.has(s.key)).map((s) => ({
    key: s.key,
    label: s.label,
    count: counts.get(s.key) || 0,
  }));

  return { items, sources, total: items.length };
});
