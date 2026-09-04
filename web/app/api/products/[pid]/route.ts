import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { storage } from '@/lib/storage';
import { HttpError } from '@/lib/http';
import { productInputSchema } from '@/lib/schemas';

export const PUT = handle(async (req: NextRequest, ctx: { params: Promise<{ pid: string }> }) => {
  const { pid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const p = await prisma.products.findFirst({ where: { id: pid, tenant_id: user.tenant_id } });
  if (!p) throw new HttpError(404, 'Produk tidak ditemukan');
  const data = productInputSchema.parse(await readBody(req));
  const image = await storage.normalizeImageField(data.image || '', 'product');
  if (p.image && image !== p.image) await storage.delete(p.image);
  await prisma.products.update({
    where: { id: pid },
    data: {
      name: data.name, sku: data.sku || '', barcode: data.barcode || '',
      category_id: data.category_id || null, price: data.price, cost: data.cost, stock: data.stock, min_stock: data.min_stock,
      unit: data.unit || 'pcs', image, description: data.description || '', active: data.active,
    },
  });
  return { ok: true };
});

export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ pid: string }> }) => {
  const { pid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager');
  const p = await prisma.products.findFirst({ where: { id: pid, tenant_id: user.tenant_id } });
  if (p) {
    await storage.delete(p.image);
    await prisma.products.delete({ where: { id: pid } });
  }
  return { ok: true };
});
