import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { rp, safeJsonParse } from '@/lib/business';
import { purchaseOrderInputSchema } from '@/lib/schemas';
import { resolveSupplier } from '../route';

export const PUT = handle(async (req: NextRequest, ctx: { params: Promise<{ pid: string }> }) => {
  const { pid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const po = await prisma.purchases.findFirst({ where: { id: pid, tenant_id: user.tenant_id } });
  if (!po) throw new HttpError(404, 'PO tidak ditemukan');
  if (po.status === 'Diterima') throw new HttpError(400, 'PO yang sudah diterima tidak dapat diubah');
  const data = purchaseOrderInputSchema.parse(await readBody(req));
  if (!data.items?.length) throw new HttpError(400, 'Item pembelian kosong');
  const { supplier_id, supplier_name } = await resolveSupplier(data.supplier_id, user.tenant_id);
  const total = data.items.reduce((s, i) => s + i.qty * i.cost, 0);
  await prisma.purchases.update({
    where: { id: pid },
    data: { supplier_id, supplier_name, items: JSON.stringify(data.items), total, note: data.note || '' },
  });
  await logActivity(user.tenant_id, user, 'Ubah PO', `${po.po_number} - ${rp(total)}`);
  return { ok: true };
});

export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ pid: string }> }) => {
  const { pid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const tid = user.tenant_id;
  const po = await prisma.purchases.findFirst({ where: { id: pid, tenant_id: tid } });
  if (!po) throw new HttpError(404, 'PO tidak ditemukan');
  if (po.status === 'Diterima') {
    if (user.role !== 'Owner') throw new HttpError(403, 'Hanya Owner yang dapat menghapus PO yang sudah diterima');
    const items = safeJsonParse<any[]>(po.items, []);
    for (const i of items) {
      const prod = await prisma.products.findFirst({ where: { id: i.product_id, tenant_id: tid } });
      if (prod) {
        const before = prod.stock || 0;
        const after = before - Number(i.qty || 0);
        await prisma.products.update({ where: { id: prod.id }, data: { stock: after } });
        await prisma.stock_movements.create({
          data: {
            id: newId(), tenant_id: tid, product_id: prod.id, product_name: i.name || '',
            type: 'Keluar', qty: Number(i.qty || 0), before, after,
            note: `Pembatalan PO ${po.po_number}`, user_name: user.name || '', created_at: new Date(),
          },
        });
      }
    }
    await prisma.purchases.delete({ where: { id: pid } });
    await logActivity(tid, user, 'Hapus PO (Diterima)', `${po.po_number} - stok dikoreksi`);
    return { ok: true, reversed: true };
  }
  await prisma.purchases.delete({ where: { id: pid } });
  await logActivity(tid, user, 'Hapus PO', po.po_number);
  return { ok: true };
});
