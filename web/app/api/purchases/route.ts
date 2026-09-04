import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { docNumber, rp, safeJsonParse } from '@/lib/business';
import { purchaseOrderInputSchema } from '@/lib/schemas';
import { serializePurchase } from '@/lib/serializers';

export async function resolveSupplier(supplierId: string | null | undefined, tenantId: string) {
  if (!supplierId) throw new HttpError(400, 'Supplier wajib dipilih');
  const sup = await prisma.suppliers.findFirst({ where: { id: supplierId, tenant_id: tenantId } });
  if (!sup) throw new HttpError(400, 'Supplier tidak ditemukan');
  const name = (sup.name || '').trim();
  if (!name || name === '-') throw new HttpError(400, "Nama supplier tidak valid (tidak boleh kosong atau '-')");
  return { supplier_id: supplierId, supplier_name: name };
}

export async function nextPoNumber(tid: string): Promise<string> {
  const count = await prisma.purchases.count({ where: { tenant_id: tid } });
  return docNumber('PO', count);
}

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const rows = await prisma.purchases.findMany({
    where: { tenant_id: user.tenant_id },
    orderBy: { created_at: 'desc' },
    take: 1000,
  });
  return rows.map(serializePurchase);
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const data = purchaseOrderInputSchema.parse(await readBody(req));
  if (!data.items || data.items.length === 0) throw new HttpError(400, 'Item pembelian kosong');
  const tid = user.tenant_id;
  const { supplier_id, supplier_name } = await resolveSupplier(data.supplier_id, tid);
  const total = data.items.reduce((s, i) => s + i.qty * i.cost, 0);
  const po = await prisma.purchases.create({
    data: {
      id: newId(), tenant_id: tid, po_number: await nextPoNumber(tid), supplier_id, supplier_name,
      items: JSON.stringify(data.items), total, note: data.note || '', customer_name: '',
      status: 'Menunggu', cashier: user.name || '', created_at: new Date(),
    },
  });
  await logActivity(tid, user, 'Buat PO', `${po.po_number} - ${rp(total)}`);
  return serializePurchase(po);
});
