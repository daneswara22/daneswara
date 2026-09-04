import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { storage } from '@/lib/storage';
import { HttpError } from '@/lib/http';
import { categoryInputSchema } from '@/lib/schemas';

export const PUT = handle(async (req: NextRequest, ctx: { params: Promise<{ cid: string }> }) => {
  const { cid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const c = await prisma.categories.findFirst({ where: { id: cid, tenant_id: user.tenant_id } });
  if (!c) throw new HttpError(404, 'Kategori tidak ditemukan');
  const data = categoryInputSchema.parse(await readBody(req));
  const newImage = await storage.normalizeImageField(data.image || '', 'category');
  if (c.image && newImage !== c.image) await storage.delete(c.image);
  await prisma.categories.update({ where: { id: cid }, data: { name: data.name, color: data.color || '#2563EB', image: newImage } });
  return { ok: true };
});

export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ cid: string }> }) => {
  const { cid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager');
  const c = await prisma.categories.findFirst({ where: { id: cid, tenant_id: user.tenant_id } });
  if (c) {
    await storage.delete(c.image);
    await prisma.categories.delete({ where: { id: cid } });
  }
  return { ok: true };
});
