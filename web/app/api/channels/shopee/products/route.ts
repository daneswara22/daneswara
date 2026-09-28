import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, toIso } from '@/lib/http';
import { ensureChannel } from '@/lib/channels/store';

export const dynamic = 'force-dynamic';

const mapSchema = z.object({
  id: z.string().trim().min(1),
  internal_product_id: z.string().trim().nullable().optional(),
  custom_product_key: z.string().trim().nullable().optional(),
  is_custom: z.boolean().optional(),
  mapping_status: z.enum(['MAPPED', 'UNMAPPED', 'IGNORED']).optional(),
});

function view(r: any) {
  return {
    id: r.id,
    external_product_id: r.external_product_id,
    external_variation_id: r.external_variation_id,
    external_sku: r.external_sku || '',
    external_name: r.external_name || '',
    external_variation: r.external_variation || '',
    internal_product_id: r.internal_product_id || null,
    custom_product_key: r.custom_product_key || null,
    is_custom: !!r.is_custom,
    mapping_status: r.mapping_status,
    last_seen_at: toIso(r.last_seen_at),
  };
}

/** GET /api/channels/shopee/products — daftar produk Shopee + status mapping. */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const ch = await ensureChannel(user.tenant_id, 'shopee');
  const url = new URL(req.url);
  const status = (url.searchParams.get('mapping_status') || '').trim().toUpperCase();
  const where: any = { tenant_id: user.tenant_id, sales_channel_id: ch.id };
  if (status) where.mapping_status = status;
  const rows = await prisma.channel_products.findMany({ where, orderBy: { last_seen_at: 'desc' }, take: 300 });
  const unmapped = rows.filter((r) => r.mapping_status === 'UNMAPPED').length;
  return { items: (rows || []).map(view), unmapped_count: unmapped };
});

/** PUT /api/channels/shopee/products — petakan produk Shopee ke produk internal. */
export const PUT = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const body = mapSchema.parse(await readBody(req));
  const ch = await ensureChannel(user.tenant_id, 'shopee');
  const row = await prisma.channel_products.findFirst({
    where: { id: body.id, tenant_id: user.tenant_id, sales_channel_id: ch.id },
  });
  if (!row) throw new HttpError(404, 'Produk kanal tidak ditemukan');

  const internalId = body.internal_product_id || null;
  const customKey = body.custom_product_key || null;
  if (internalId) {
    const p = await prisma.products.findFirst({ where: { id: internalId, tenant_id: user.tenant_id } });
    if (!p) throw new HttpError(400, 'Produk internal tidak ditemukan');
  }
  if (customKey) {
    const c = await prisma.custom_products.findFirst({
      where: { tenant_id: user.tenant_id, product_key: customKey },
    });
    if (!c) throw new HttpError(400, 'Jenis produk Custom Tees tidak ditemukan');
  }
  const status =
    body.mapping_status || (internalId || customKey ? 'MAPPED' : 'UNMAPPED');
  const updated = await prisma.channel_products.update({
    where: { id: row.id },
    data: {
      internal_product_id: internalId,
      custom_product_key: customKey,
      is_custom: body.is_custom !== undefined ? body.is_custom : !!customKey,
      mapping_status: status,
      updated_at: new Date(),
    },
  });
  return view(updated);
});
