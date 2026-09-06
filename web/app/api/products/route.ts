import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { storage } from '@/lib/storage';
import { newId } from '@/lib/http';
import { safeJsonParse } from '@/lib/business';
import { productInputSchema } from '@/lib/schemas';
import { serializeProduct } from '@/lib/serializers';

function sortKey(row: any) {
  const so = row.sort_order != null ? row.sort_order : 1e9;
  return [so, (row.name || '').toLowerCase()];
}

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const tid = user.tenant_id;
  const prods = await prisma.products.findMany({ where: { tenant_id: tid } });
  const openPos = await prisma.purchases.findMany({ where: { tenant_id: tid, status: 'Menunggu' }, select: { po_number: true, items: true } });
  const poMap: Record<string, string[]> = {};
  for (const po of openPos) {
    for (const it of safeJsonParse<any[]>(po.items, [])) {
      const pid = it?.product_id;
      if (!pid) continue;
      (poMap[pid] ||= []).push(po.po_number);
    }
  }
  const out = (prods || []).map((p: any) => {
    const s = serializeProduct(p) as any;
    const nums = poMap[p.id] || [];
    s.open_po = nums.length > 0;
    s.open_po_numbers = nums;
    return s;
  });
  out.sort((a: any, b: any) => {
    const [as, an] = sortKey(a), [bs, bn] = sortKey(b);
    return as !== bs ? (as as number) - (bs as number) : String(an).localeCompare(String(bn));
  });
  return out;
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const data = productInputSchema.parse(await readBody(req));
  const count = await prisma.products.count({ where: { tenant_id: user.tenant_id } });
  const image = await storage.normalizeImageField(data.image || '', 'product');
  const p = await prisma.products.create({
    data: {
      id: newId(), tenant_id: user.tenant_id, name: data.name, sku: data.sku || '', barcode: data.barcode || '',
      category_id: data.category_id || null, price: data.price, cost: data.cost, stock: data.stock, min_stock: data.min_stock,
      unit: data.unit || 'pcs', image, description: data.description || '', active: data.active, sort_order: count,
      created_at: new Date(),
    },
  });
  await logActivity(user.tenant_id, user, 'Tambah Produk', data.name);
  return serializeProduct(p);
});
