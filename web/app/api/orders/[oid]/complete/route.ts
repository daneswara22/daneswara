import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { safeJsonParse } from '@/lib/business';
import { settleOrderSchema } from '@/lib/schemas';
import { serializeSale } from '@/lib/serializers';
import { nextInvoice, decrementStock } from '../../../sales/route';

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ oid: string }> }) => {
  const { oid } = await ctx.params;
  const user = await getCurrentUser(req);
  const tid = user.tenant_id;
  const order = await prisma.orders.findFirst({ where: { id: oid, tenant_id: tid } });
  if (!order) throw new HttpError(404, 'Pesanan tidak ditemukan');
  if (order.status === 'Selesai') throw new HttpError(400, 'Pesanan sudah selesai');
  const data = settleOrderSchema.parse(await readBody(req));
  const remaining = Math.max(0, order.total - (order.deposit_amount || 0));
  if (data.paid_amount < remaining) throw new HttpError(400, 'Nominal pelunasan kurang dari sisa tagihan');
  const items = safeJsonParse<any[]>(order.items, []);
  await decrementStock(tid, user, items, `Pesanan ${order.order_number}`);
  const totalCost = items.reduce((s, i) => s + Number(i.cost || 0) * Number(i.qty || 0), 0);
  const invoice = await nextInvoice(tid);
  if (order.customer_id) {
    const c = await prisma.customers.findFirst({ where: { id: order.customer_id, tenant_id: tid } });
    if (c) await prisma.customers.update({ where: { id: c.id }, data: { total_spent: (c.total_spent || 0) + order.total, visits: (c.visits || 0) + 1 } });
  }
  const paidTotal = data.paid_amount + (order.deposit_amount || 0);
  const sale = await prisma.sales.create({
    data: {
      id: newId(), tenant_id: tid, invoice, items: JSON.stringify(items),
      subtotal: order.subtotal, discount: order.discount, tax_rate: order.tax_rate, tax: order.tax,
      total: order.total, cost: totalCost, profit: (order.subtotal - order.discount) - totalCost,
      payment_method: data.payment_method, paid_amount: paidTotal,
      change: Math.max(0, paidTotal - order.total),
      customer_name: order.customer_name || '', customer_id: order.customer_id || null, customer_phone: '',
      from_order: order.order_number, channel: order.channel || 'Toko',
      cashier: user.name || '', cashier_id: user.id, refunded: false, created_at: new Date(),
    },
  });
  await prisma.orders.update({
    where: { id: oid },
    data: {
      status: 'Selesai', completed_at: new Date(), invoice,
      payment_method: data.payment_method, settle_paid: data.paid_amount, remaining: 0,
    },
  });
  await logActivity(tid, user, 'Pesanan Selesai', `${order.order_number} -> ${invoice}`);
  return serializeSale(sale);
});
