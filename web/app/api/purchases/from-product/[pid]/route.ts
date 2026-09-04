import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { supplierRefSchema } from '@/lib/schemas';
import { serializePurchase } from '@/lib/serializers';
import { resolveSupplier, nextPoNumber } from '../../route';

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ pid: string }> }) => {
  const { pid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const tid = user.tenant_id;
  const prod = await prisma.products.findFirst({ where: { id: pid, tenant_id: tid } });
  if (!prod) throw new HttpError(404, 'Produk tidak ditemukan');
  const ref = supplierRefSchema.parse(await readBody(req));
  const { supplier_id, supplier_name } = await resolveSupplier(ref.supplier_id, tid);
  const stock = prod.stock || 0;
  const qty = stock < 0 ? -stock : 1;
  const cost = prod.cost || 0;
  const items = [{ product_id: pid, name: prod.name, qty, cost }];
  const po = await prisma.purchases.create({
    data: {
      id: newId(), tenant_id: tid, po_number: await nextPoNumber(tid), supplier_id, supplier_name,
      items: JSON.stringify(items), total: qty * cost, note: 'Restok stok minus',
      customer_name: '', status: 'Menunggu', cashier: user.name || '', created_at: new Date(),
    },
  });
  await logActivity(tid, user, 'Buat PO Restok', `${po.po_number} - ${prod.name} x${qty}`);
  return serializePurchase(po);
});
