import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { supplierInputSchema } from '@/lib/schemas';

export const PUT = handle(async (req: NextRequest, ctx: { params: Promise<{ sid: string }> }) => {
  const { sid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const s = await prisma.suppliers.findFirst({ where: { id: sid, tenant_id: user.tenant_id } });
  if (!s) throw new HttpError(404, 'Supplier tidak ditemukan');
  const data = supplierInputSchema.parse(await readBody(req));
  await prisma.suppliers.update({
    where: { id: sid },
    data: { name: data.name, phone: data.phone || '', email: data.email || '', address: data.address || '' },
  });
  return { ok: true };
});

export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ sid: string }> }) => {
  const { sid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager');
  await prisma.suppliers.deleteMany({ where: { id: sid, tenant_id: user.tenant_id } });
  return { ok: true };
});
