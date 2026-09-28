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
  const url = new URL(req.url);
  const p = (k: string) => (url.searchParams.get(k) || '').trim();
  const channel = p('sales_channel').toLowerCase();
  const status = p('status');
  const internalStatus = p('internal_status').toUpperCase();
  const paymentStatus = p('payment_status').toUpperCase();
  const customer = p('customer');
  const sku = p('sku');
  const product = p('product');
  const dateFrom = p('date_from');
  const dateTo = p('date_to');
  const limit = Math.min(1000, Math.max(1, Number(p('limit')) || 500));

  const where: any = { tenant_id: tid };
  // Pesanan lama (POS/toko) tidak punya sales_channel -> dianggap 'manual'.
  if (channel && channel !== 'all') {
    where.OR = channel === 'manual' ? [{ sales_channel: 'manual' }, { sales_channel: null }] : [{ sales_channel: channel }];
  }
  if (status) where.status = status;
  if (internalStatus) where.internal_status = internalStatus;
  // Pesanan lama belum punya payment_status -> turunkan dari sisa tagihan.
  if (paymentStatus) {
    const legacy: any[] = [{ payment_status: paymentStatus }];
    if (paymentStatus === 'PAID') legacy.push({ payment_status: null, remaining: { lte: 0 } });
    if (paymentStatus === 'UNPAID') legacy.push({ payment_status: null, deposit_amount: { lte: 0 }, remaining: { gt: 0 } });
    if (paymentStatus === 'PARTIAL') legacy.push({ payment_status: null, deposit_amount: { gt: 0 }, remaining: { gt: 0 } });
    where.AND = [...(where.AND || []), { OR: legacy }];
  }
  if (customer) where.customer_name = { contains: customer };
  if (dateFrom || dateTo) {
    where.created_at = {};
    if (dateFrom) where.created_at.gte = new Date(`${dateFrom}T00:00:00`);
    if (dateTo) where.created_at.lte = new Date(`${dateTo}T23:59:59`);
  }
  if (sku || product) where.items = { contains: sku || product };

  const orders = await prisma.orders.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
  });
  const pos = await prisma.purchases.findMany({
    where: { tenant_id: tid, order_id: { not: null } },
    select: { order_id: true, po_number: true },
  });
  const poMap: Record<string, string[]> = {};
  for (const p of pos) {
    if (p.order_id) (poMap[p.order_id] ||= []).push(p.po_number);
  }
  return (orders || []).map((o: any) => {
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
  const subtotal = (items || []).reduce((s, i) => s + i.price * i.qty, 0);
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
      sales_channel: 'manual',
      internal_status: isDraft ? 'NEW' : 'PROCESSING',
      payment_status: isDraft ? 'UNPAID' : 'PARTIAL',
      order_date: new Date(),
      updated_at: new Date(),
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
