import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { docNumber, rp, safeJsonParse } from '@/lib/business';
import { customOrderInputSchema } from '@/lib/schemas';
import { serializeOrder } from '@/lib/serializers';

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const tid = user.tenant_id;
  const orders = await prisma.orders.findMany({
    where: { tenant_id: tid },
    orderBy: { created_at: 'desc' },
    take: 500,
  });
  const pos = await prisma.purchases.findMany({
    where: { tenant_id: tid, order_id: { not: null } },
    select: { order_id: true, po_number: true },
  });
  const poMap: Record<string, string[]> = {};
  for (const p of pos) {
    if (p.order_id) (poMap[p.order_id] ||= []).push(p.po_number);
  }
  return orders.map((o: any) => {
    const d = serializeOrder(o) as any;
    const nums = poMap[o.id] || [];
    d.po_created = nums.length > 0;
    d.po_numbers = nums;
    return d;
  });
});

export const POST = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const data = customOrderInputSchema.parse(await readBody(req));
  if (!data.items || data.items.length === 0) throw new HttpError(400, 'Item pesanan kosong');
  const tid = user.tenant_id;
  const items = data.items;
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const taxed = (subtotal - data.discount) * (data.tax_rate / 100);
  const total = subtotal - data.discount + taxed;
  let custName = data.customer_name || '';
  if (data.customer_id) {
    const c = await prisma.customers.findFirst({ where: { id: data.customer_id, tenant_id: tid } });
    if (c) custName = c.name;
  }
  const count = await prisma.orders.count({ where: { tenant_id: tid } });
  const isDraft = (data.deposit_amount || 0) <= 0;
  const o = await prisma.orders.create({
    data: {
      id: newId(), tenant_id: tid, order_number: docNumber('ORD', count),
      customer_id: data.customer_id || null, customer_name: custName,
      items: JSON.stringify(items),
      subtotal, discount: data.discount, tax_rate: data.tax_rate, tax: taxed, total,
      deposit_amount: data.deposit_amount, deposit_method: data.deposit_method,
      remaining: Math.max(0, total - data.deposit_amount),
      note: data.note || '', order_type: data.order_type || 'Reguler',
      channel: (data.channel || 'Toko').trim() || 'Toko',
      status: isDraft ? 'Draft' : 'Proses', cashier: user.name || '',
      created_at: new Date(),
    },
  });
  if (isDraft) {
    await logActivity(tid, user, 'Draft Pesanan', `${o.order_number} (${o.order_type}) \u2014 belum bayar`);
  } else {
    await logActivity(tid, user, 'Pesanan Custom + Deposit', `${o.order_number} DP ${rp(data.deposit_amount)}`);
  }
  return serializeOrder(o);
});
