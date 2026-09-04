import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { safeJsonParse } from '@/lib/business';

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ pid: string }> }) => {
  const { pid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const tid = user.tenant_id;
  const po = await prisma.purchases.findFirst({ where: { id: pid, tenant_id: tid } });
  if (!po) throw new HttpError(404, 'PO tidak ditemukan');
  if (po.status === 'Diterima') throw new HttpError(400, 'PO sudah diterima');
  const items = safeJsonParse<any[]>(po.items, []);
  for (const i of items) {
    const prod = await prisma.products.findFirst({ where: { id: i.product_id, tenant_id: tid } });
    if (prod) {
      const before = prod.stock || 0;
      const after = before + Number(i.qty || 0);
      await prisma.products.update({
        where: { id: prod.id },
        data: { stock: after, cost: Number(i.cost ?? prod.cost ?? 0) },
      });
      await prisma.stock_movements.create({
        data: {
          id: newId(), tenant_id: tid, product_id: prod.id, product_name: i.name || '',
          type: 'Masuk', qty: Number(i.qty || 0), before, after,
          note: `Penerimaan ${po.po_number}`, user_name: user.name || '', created_at: new Date(),
        },
      });
    }
  }
  await prisma.purchases.update({ where: { id: pid }, data: { status: 'Diterima', received_at: new Date() } });
  await logActivity(tid, user, 'Terima Barang', po.po_number);
  return { ok: true };
});
