import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { safeJsonParse } from '@/lib/business';
import { updateOrderSchema } from '@/lib/schemas';
import { serializeOrder, serializeOrderDetail } from '@/lib/serializers';

async function getOrder(oid: string, tid: string) {
  const o = await prisma.orders.findFirst({ where: { id: oid, tenant_id: tid } });
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan');
  return o;
}

function isMarketplace(order: any): boolean {
  const ch = String(order?.sales_channel || 'manual');
  return ch !== 'manual' && ch !== 'website';
}

/** GET /api/orders/:id — detail pesanan + data mentah marketplace. */
export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ oid: string }> }) => {
  const { oid } = await ctx.params;
  const user = await getCurrentUser(req);
  const order = await getOrder(oid, user.tenant_id);
  const custom = await prisma.custom_tee_orders.findMany({
    where: { tenant_id: user.tenant_id, source_order_id: order.id },
    select: { id: true, order_code: true, status: true, product_title: true, qty: true },
  });
  return { ...serializeOrderDetail(order), custom_tee_orders: custom };
});

export const PUT = handle(async (req: NextRequest, ctx: { params: Promise<{ oid: string }> }) => {
  const { oid } = await ctx.params;
  const user = await getCurrentUser(req);
  const order = await getOrder(oid, user.tenant_id);
  if (isMarketplace(order)) {
    throw new HttpError(400, 'Pesanan marketplace mengikuti data Shopee — ubah dari aplikasi Shopee Seller.');
  }
  if (order.status !== 'Draft') throw new HttpError(400, 'Hanya draft (belum bayar) yang bisa diubah');
  const data = updateOrderSchema.parse(await readBody(req));
  if (!data.items || data.items.length === 0) throw new HttpError(400, 'Item pesanan kosong');
  const items = data.items;
  const subtotal = (items || []).reduce((s, i) => s + i.price * i.qty, 0);
  const taxed = (subtotal - data.discount) * (data.tax_rate / 100);
  const total = subtotal - data.discount + taxed;
  const updated = await prisma.orders.update({
    where: { id: oid },
    data: {
      items: JSON.stringify(items),
      subtotal, discount: data.discount, tax_rate: data.tax_rate, tax: taxed, total, remaining: total,
      customer_name: data.customer_name || order.customer_name || '',
      order_type: data.order_type || 'Reguler',
    },
  });
  await logActivity(user.tenant_id, user, 'Draft Pesanan Diubah', order.order_number);
  return serializeOrder(updated);
});

export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ oid: string }> }) => {
  const { oid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager');
  const order = await getOrder(oid, user.tenant_id);
  if (isMarketplace(order)) {
    throw new HttpError(
      400,
      'Pesanan marketplace tidak bisa dihapus (akan muncul lagi saat sinkron). Batalkan pesanannya di Shopee Seller.',
    );
  }
  await prisma.orders.deleteMany({ where: { id: oid, tenant_id: user.tenant_id } });
  return { ok: true };
});
