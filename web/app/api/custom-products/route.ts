/**
 * Jenis Produk — endpoint admin.
 *   GET  /api/custom-products?page=1&limit=12&q=&active=1   daftar (paginated)
 *   POST /api/custom-products                               buat jenis produk baru
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { storage } from '@/lib/storage';
import { serializeProductType } from '@/lib/serializers';
import { slugifyProductKey } from '@/lib/productTypes';
import { listProductTypes, ensureSeedProductTypes } from '@/lib/productTypeQueries';

export const createSchema = z.object({
  title: z.string().trim().min(2, 'Nama produk minimal 2 karakter').max(200),
  subtitle: z.string().trim().max(200).optional().nullable(),
  price: z.coerce.number().int().min(0, 'Harga tidak boleh negatif').max(1_000_000_000),
  supplier: z.string().trim().max(200).optional().nullable(),
  size_region: z.string().trim().max(120).optional().nullable(),
  model: z.string().trim().max(200).optional().nullable(),
  material: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  thumbnail_url: z.string().trim().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).max(100000).optional(),
  product_key: z.string().trim().max(80).optional().nullable(),
});

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const url = new URL(req.url);
  await ensureSeedProductTypes(user.tenant_id);
  return await listProductTypes({
    tenantId: user.tenant_id,
    page: Number(url.searchParams.get('page') || 1),
    limit: Number(url.searchParams.get('limit') || 12),
    q: url.searchParams.get('q') || undefined,
    activeOnly: url.searchParams.get('active') === '1',
  });
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const data = createSchema.parse(await readBody(req));

  let key = slugifyProductKey(data.product_key || data.title);
  // pastikan unik per tenant
  for (let i = 2; i < 100; i++) {
    const taken = await prisma.custom_products.findFirst({
      where: { tenant_id: user.tenant_id, product_key: key },
      select: { id: true },
    });
    if (!taken) break;
    key = `${slugifyProductKey(data.product_key || data.title)}-${i}`;
  }

  const thumb = await storage.normalizeImageField(data.thumbnail_url, 'mockup');
  const now = new Date();
  const created = await prisma.custom_products.create({
    data: {
      id: newId(),
      tenant_id: user.tenant_id,
      product_key: key,
      title: data.title,
      subtitle: data.subtitle || null,
      description: data.description || '',
      price: data.price,
      supplier: data.supplier || null,
      size_region: data.size_region || null,
      model: data.model || null,
      material: data.material || null,
      thumbnail_url: thumb || null,
      size_guide_url: null,
      sizes_json: '[]',
      specs_json: '[]',
      is_active: data.is_active ?? true,
      sort_order: data.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    },
    include: { colors: true, size_chart: true },
  });
  if (!created) throw new HttpError(500, 'Gagal membuat jenis produk');
  await logActivity(user.tenant_id, user, 'Tambah Jenis Produk', created.title);
  return serializeProductType(created);
});
