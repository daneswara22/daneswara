import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { storage } from '@/lib/storage';
import { serializeCustomProduct } from '@/lib/serializers';
import { getCustomProductDefault } from '@/lib/customProductDefaults';

const DEFAULT_KEY = 'premium-cotton-7200';

const updateSchema = z.object({
  product_key: z.string().trim().min(1).max(80).default(DEFAULT_KEY),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1),
  sizes: z.array(z.string().trim().min(1).max(20)).min(1).max(30),
  specs: z.array(z.string().trim().min(1).max(300)).min(0).max(30),
  size_guide_image: z.string().trim().optional().nullable(),
  clear_size_guide: z.boolean().optional(),
});

async function findOrSeed(tenantId: string, productKey: string) {
  let row = await prisma.custom_products.findFirst({
    where: { tenant_id: tenantId, product_key: productKey },
  });
  if (row) return row;
  const d = getCustomProductDefault(productKey);
  const now = new Date();
  row = await prisma.custom_products.create({
    data: {
      id: newId(),
      tenant_id: tenantId,
      product_key: productKey,
      title: d.title,
      description: d.description,
      size_guide_url: d.size_guide_url,
      sizes_json: JSON.stringify(d.sizes),
      specs_json: JSON.stringify(d.specs),
      created_at: now,
      updated_at: now,
    },
  });
  return row;
}

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const url = new URL(req.url);
  const productKey = url.searchParams.get('product_key') || DEFAULT_KEY;
  const row = await findOrSeed(user.tenant_id, productKey);
  return serializeCustomProduct(row);
});

export const PUT = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const body = await readBody(req);
  const data = updateSchema.parse(body);
  const productKey = data.product_key || DEFAULT_KEY;

  const existing = await findOrSeed(user.tenant_id, productKey);

  let sizeGuideUrl: string | null | undefined = existing.size_guide_url;
  if (data.clear_size_guide) {
    if (existing.size_guide_url && existing.size_guide_url.startsWith('http')) {
      await storage.delete(existing.size_guide_url).catch(() => {});
    }
    sizeGuideUrl = null;
  } else if (data.size_guide_image) {
    const uploaded = data.size_guide_image.startsWith('data:image')
      ? await storage.uploadDataUri(data.size_guide_image, 'mockup')
      : data.size_guide_image;
    if (!uploaded) throw new HttpError(400, 'Gagal memproses gambar size guide');
    if (
      existing.size_guide_url &&
      existing.size_guide_url.startsWith('http') &&
      existing.size_guide_url !== uploaded
    ) {
      await storage.delete(existing.size_guide_url).catch(() => {});
    }
    sizeGuideUrl = uploaded;
  }

  const updated = await prisma.custom_products.update({
    where: { id: existing.id },
    data: {
      title: data.title.trim(),
      description: data.description.trim(),
      sizes_json: JSON.stringify(data.sizes),
      specs_json: JSON.stringify(data.specs),
      size_guide_url: sizeGuideUrl ?? null,
      updated_at: new Date(),
    },
  });
  await logActivity(user.tenant_id, user, 'Update Produk Custom Design', data.title);
  return serializeCustomProduct(updated);
});
