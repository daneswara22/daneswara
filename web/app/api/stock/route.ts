import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { newId, HttpError } from '@/lib/http';
import { stockInputSchema } from '@/lib/schemas';
import { serializeStockMovement } from '@/lib/serializers';

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const data = stockInputSchema.parse(await readBody(req));
  const prod = await prisma.products.findFirst({ where: { id: data.product_id, tenant_id: user.tenant_id } });
  if (!prod) throw new HttpError(404, 'Produk tidak ditemukan');
  const before = prod.stock || 0;
  let after = before;
  if (data.type === 'Masuk') after = before + data.qty;
  else if (data.type === 'Keluar') after = before - data.qty;
  else if (data.type === 'Opname') after = data.qty;
  else after = before + data.qty;
  await prisma.products.update({ where: { id: prod.id }, data: { stock: after } });
  const mv = await prisma.stock_movements.create({
    data: {
      id: newId(), tenant_id: user.tenant_id, product_id: prod.id, product_name: prod.name,
      type: data.type, qty: data.qty, before, after, note: data.note || '', user_name: user.name || '',
      created_at: new Date(),
    },
  });
  await logActivity(user.tenant_id, user, `Stok ${data.type}`, `${prod.name}: ${before} -> ${after}`);
  return serializeStockMovement(mv);
});
