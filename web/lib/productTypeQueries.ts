/**
 * Query bersama untuk Jenis Produk. Dipisah dari route handler supaya
 * endpoint admin dan publik memakai bentuk JSON yang sama persis.
 */
import { prisma } from './db';
import { serializeProductType } from './serializers';
import { PRODUCT_TYPE_SEEDS } from './productTypes';
import { newId } from './http';

export interface ListArgs {
  tenantId?: string;
  page: number;
  limit: number;
  q?: string;
  activeOnly?: boolean;
}

/** Daftar produk + warna + size chart, sudah dipaginasi (lazy load friendly). */
export async function listProductTypes({ tenantId, page, limit, q, activeOnly }: ListArgs) {
  const safeLimit = Math.min(Math.max(limit || 12, 1), 50);
  const safePage = Math.max(page || 1, 1);
  const where: any = {};
  if (tenantId) where.tenant_id = tenantId;
  if (activeOnly) where.is_active = true;
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { title: { contains: term } },
      { supplier: { contains: term } },
      { material: { contains: term } },
      { product_key: { contains: term } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.custom_products.count({ where }),
    prisma.custom_products.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: {
        colors: { orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] },
        size_chart: { orderBy: [{ sort_order: 'asc' }] },
      },
    }),
  ]);

  const items = (rows || []).map((r) => serializeProductType(r));
  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
    has_more: safePage * safeLimit < total,
  };
}

export async function getProductTypeById(id: string, tenantId?: string) {
  const row = await prisma.custom_products.findUnique({
    where: { id },
    include: {
      colors: { orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] },
      size_chart: { orderBy: [{ sort_order: 'asc' }] },
    },
  });
  if (!row) return null;
  if (tenantId && row.tenant_id !== tenantId) return null;
  return row;
}

/**
 * Seeding jenis produk bawaan. Dikerjakan **per `product_key`**, jadi:
 *   - baris yang belum ada akan dibuat,
 *   - baris lama (mis. `premium-cotton-7200` dari fitur Custom Tees) hanya
 *     dilengkapi kolom info baru yang masih kosong \u2014 judul & deskripsi yang
 *     sudah diedit admin tidak ditimpa,
 *   - warna / size chart hanya ditambahkan kalau produk itu belum punya.
 * Idempotent: mengembalikan jumlah baris yang benar-benar berubah.
 */
export async function ensureSeedProductTypes(tenantId: string) {
  const now = new Date();
  let changed = 0;

  for (const seed of PRODUCT_TYPE_SEEDS) {
    let product = await prisma.custom_products.findFirst({
      where: { tenant_id: tenantId, product_key: seed.product_key },
    });

    if (!product) {
      product = await prisma.custom_products.create({
        data: {
          id: newId(),
          tenant_id: tenantId,
          product_key: seed.product_key,
          title: seed.title,
          subtitle: seed.subtitle,
          description: seed.description,
          price: seed.price,
          supplier: seed.supplier,
          size_region: seed.size_region,
          model: seed.model,
          material: seed.material,
          thumbnail_url: null,
          size_guide_url: null,
          sizes_json: JSON.stringify(seed.size_chart.map((s) => s.label)),
          specs_json: JSON.stringify([
            `Suplier: ${seed.supplier}`,
            `Model: ${seed.model}`,
            `Bahan: ${seed.material}`,
          ]),
          is_active: true,
          sort_order: seed.sort_order,
          created_at: now,
          updated_at: now,
        },
      });
      changed++;
    } else {
      // lengkapi kolom info yang masih kosong saja
      const patch: any = {};
      if (!product.price) patch.price = seed.price;
      if (!product.supplier) patch.supplier = seed.supplier;
      if (!product.size_region) patch.size_region = seed.size_region;
      if (!product.model) patch.model = seed.model;
      if (!product.material) patch.material = seed.material;
      if (!product.subtitle) patch.subtitle = seed.subtitle;
      if (!product.sort_order) patch.sort_order = seed.sort_order;
      if (Object.keys(patch).length) {
        patch.updated_at = now;
        product = await prisma.custom_products.update({ where: { id: product.id }, data: patch });
        changed++;
      }
    }

    const productId = product.id;
    const colorCount = await prisma.custom_product_colors.count({ where: { product_id: productId } });
    if (colorCount === 0) {
      await prisma.custom_product_colors.createMany({
        data: seed.colors.map((c, i) => ({
          id: newId(),
          tenant_id: tenantId,
          product_id: productId,
          name: c.name,
          hex: c.hex.toUpperCase(),
          thumb_url: null,
          sort_order: i * 10,
          is_active: true,
          created_at: now,
          updated_at: now,
        })),
      });
      changed++;
    }

    const sizeCount = await prisma.custom_product_sizes.count({ where: { product_id: productId } });
    if (sizeCount === 0) {
      await prisma.custom_product_sizes.createMany({
        data: seed.size_chart.map((s, i) => ({
          id: newId(),
          tenant_id: tenantId,
          product_id: productId,
          label: s.label,
          chest_cm: s.chest_cm,
          length_cm: s.length_cm,
          sort_order: i * 10,
          created_at: now,
          updated_at: now,
        })),
      });
      changed++;
    }
  }

  return changed;
}
