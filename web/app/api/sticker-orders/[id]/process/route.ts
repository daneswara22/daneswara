import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { docNumber } from '@/lib/business';
import { POS_PRODUCT_BY_MATERIAL } from '@/lib/stickerPricing';
import { serializeStickerOrder as ser } from '@/lib/stickerSerialize';

export const dynamic = 'force-dynamic';

/**
 * Proses pesanan sticker: buat draft pesanan di POS memakai produk POS yang
 * sudah ada sesuai bahan (tanpa membuat produk duplikat).
 */
export const POST = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Kasir');
  const { id } = await ctx.params;
  const tid = user.tenant_id;

  const o = await prisma.sticker_orders.findFirst({ where: { id, tenant_id: tid } });
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan');
  if (o.pos_order_id) {
    const exist = await prisma.orders.findFirst({ where: { id: o.pos_order_id, tenant_id: tid } });
    if (exist) return { ...ser(o), pos_order_number: exist.order_number, already: true };
  }

  const target = POS_PRODUCT_BY_MATERIAL[o.material as keyof typeof POS_PRODUCT_BY_MATERIAL];
  if (!target) throw new HttpError(400, 'Bahan tidak dikenal');

  // Pakai produk POS yang sudah ada (cari persis dulu, lalu longgar).
  let product = await prisma.products.findFirst({ where: { tenant_id: tid, name: target.name } });
  if (!product) {
    product = await prisma.products.findFirst({
      where: { tenant_id: tid, AND: target.match.map((t) => ({ name: { contains: t } })) },
    });
  }
  if (!product) throw new HttpError(400, `Produk POS "${target.name}" belum ada. Tambahkan dulu di menu Produk.`);

  const price = Number(o.unit_price);
  const qty = o.sheets;
  const items = [{
    product_id: product.id,
    name: product.name,
    price,
    qty,
    cost: Number(product.cost || 0),
    disc: 0,
    note: `${o.order_code} · sticker ${o.material}`,
  }];
  const subtotal = price * qty;
  const custName = `${o.customer_name} - ${o.customer_phone}`;
  const count = await prisma.orders.count({ where: { tenant_id: tid } });
  const now = new Date();

  const posOrder = await prisma.orders.create({
    data: {
      id: newId(), tenant_id: tid, order_number: docNumber('ORD', count),
      customer_id: null, customer_name: custName,
      items: JSON.stringify(items),
      subtotal, discount: 0, tax_rate: 0, tax: 0, total: subtotal,
      deposit_amount: 0, deposit_method: 'Tunai', remaining: subtotal,
      note: [o.order_code, o.note].filter(Boolean).join(' · '),
      order_type: 'Custom', channel: 'Toko', status: 'Draft', cashier: user.name || '',
      sales_channel: 'manual', internal_status: 'NEW', payment_status: 'UNPAID',
      order_date: now, updated_at: now, created_at: now,
    },
  });

  const updated = await prisma.sticker_orders.update({
    where: { id: o.id },
    data: { status: 'Proses', pos_order_id: posOrder.id, updated_at: now },
  });
  return { ...ser(updated), pos_order_number: posOrder.order_number };
});
