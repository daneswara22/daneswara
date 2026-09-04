import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { safeJsonParse } from '@/lib/business';
import { supplierRefSchema } from '@/lib/schemas';
import { serializePurchase } from '@/lib/serializers';
import { resolveSupplier, nextPoNumber } from '../../route';

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ oid: string }> }) => {
  const { oid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const tid = user.tenant_id;
  const order = await prisma.orders.findFirst({ where: { id: oid, tenant_id: tid } });
  if (!order) throw new HttpError(404, 'Pesanan tidak ditemukan');
  const orderItems = safeJsonParse<any[]>(order.items, []);
  if (!orderItems.length) throw new HttpError(400, 'Pesanan tidak memiliki item');
  const ref = supplierRefSchema.parse(await readBody(req));
  const { supplier_id, supplier_name } = await resolveSupplier(ref.supplier_id, tid);
  const items: any[] = [];
  for (const it of orderItems) {
    const prod = await prisma.products.findFirst({ where: { id: it.product_id, tenant_id: tid } });
    const cost = prod ? prod.cost : it.cost || 0;
    items.push({ product_id: it.product_id, name: it.name, qty: it.qty, cost });
  }
  const total = items.reduce((s, i) => s + i.qty * i.cost, 0);
  const po = await prisma.purchases.create({
    data: {
      id: newId(), tenant_id: tid, po_number: await nextPoNumber(tid), supplier_id, supplier_name,
      items: JSON.stringify(items), total, note: `Dari pesanan ${order.order_number}`,
      customer_name: order.customer_name || '', order_id: oid, order_number: order.order_number,
      status: 'Menunggu', cashier: user.name || '', created_at: new Date(),
    },
  });
  await logActivity(tid, user, 'Buat PO dari Pesanan', `${po.po_number} <- ${order.order_number}`);
  return serializePurchase(po);
});
