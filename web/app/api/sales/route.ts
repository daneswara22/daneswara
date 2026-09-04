// Sales route: create, list, refund. Held orders separate route.
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { docNumber, safeJsonParse, rp } from '@/lib/business';
import { saleInputSchema } from '@/lib/schemas';
import { serializeSale } from '@/lib/serializers';

export async function nextInvoice(tid: string): Promise<string> {
  const count = await prisma.sales.count({ where: { tenant_id: tid } });
  return docNumber('INV', count);
}

export async function decrementStock(tid: string, user: any, items: any[], note: string) {
  for (const i of items) {
    const pid = i.product_id;
    const prod = await prisma.products.findFirst({ where: { id: pid, tenant_id: tid } });
    if (!prod) continue;
    const before = prod.stock || 0;
    const after = before - Number(i.qty || 0);
    await prisma.products.update({ where: { id: pid }, data: { stock: after } });
    await prisma.stock_movements.create({
      data: {
        id: newId(), tenant_id: tid, product_id: pid, product_name: i.name || '',
        type: 'Keluar', qty: Number(i.qty || 0), before, after,
        note, user_name: user.name || '', created_at: new Date(),
      },
    });
  }
}

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const limit = Math.min(parseInt(new URL(req.url).searchParams.get('limit') || '100'), 5000);
  const rows = await prisma.sales.findMany({
    where: { tenant_id: user.tenant_id },
    orderBy: { created_at: 'desc' },
    take: limit,
  });
  return rows.map(serializeSale);
});

export const POST = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const data = saleInputSchema.parse(await readBody(req));
  if (!data.items || data.items.length === 0) throw new HttpError(400, 'Keranjang kosong');
  const tid = user.tenant_id;
  const items = data.items;
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const totalCost = items.reduce((s, i) => s + i.cost * i.qty, 0);
  const taxed = (subtotal - data.discount) * (data.tax_rate / 100);
  const total = subtotal - data.discount + taxed;
  await decrementStock(tid, user, items, 'Penjualan POS');
  const invoice = await nextInvoice(tid);
  let custName = data.customer_name || '';
  let custPhone = '';
  if (data.customer_id) {
    const cust = await prisma.customers.findFirst({ where: { id: data.customer_id, tenant_id: tid } });
    if (cust) {
      custName = cust.name;
      custPhone = cust.phone || '';
      await prisma.customers.update({
        where: { id: cust.id },
        data: { total_spent: (cust.total_spent || 0) + total, visits: (cust.visits || 0) + 1 },
      });
    }
  }
  const sale = await prisma.sales.create({
    data: {
      id: newId(), tenant_id: tid, invoice, items: JSON.stringify(items),
      subtotal, discount: data.discount, tax_rate: data.tax_rate, tax: taxed, total,
      cost: totalCost, profit: (subtotal - data.discount) - totalCost,
      payment_method: data.payment_method, paid_amount: data.paid_amount,
      change: Math.max(0, data.paid_amount - total),
      customer_name: custName, customer_id: data.customer_id || null, customer_phone: custPhone,
      channel: (data.channel || 'Toko').trim() || 'Toko',
      cashier: user.name || '', cashier_id: user.id,
      refunded: false, created_at: new Date(),
    },
  });
  await logActivity(tid, user, 'Transaksi Penjualan', `${invoice} - ${rp(total)}`);
  return serializeSale(sale);
});
