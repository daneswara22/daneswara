import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { customerInputSchema } from '@/lib/schemas';

export const PUT = handle(async (req: NextRequest, ctx: { params: Promise<{ cid: string }> }) => {
  const { cid } = await ctx.params;
  const user = await getCurrentUser(req);
  const c = await prisma.customers.findFirst({ where: { id: cid, tenant_id: user.tenant_id } });
  if (!c) throw new HttpError(404, 'Pelanggan tidak ditemukan');
  const data = customerInputSchema.parse(await readBody(req));
  await prisma.customers.update({
    where: { id: cid },
    data: { name: data.name, phone: data.phone || '', email: data.email || '', address: data.address || '' },
  });
  return { ok: true };
});

export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ cid: string }> }) => {
  const { cid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager');
  await prisma.customers.deleteMany({ where: { id: cid, tenant_id: user.tenant_id } });
  return { ok: true };
});
