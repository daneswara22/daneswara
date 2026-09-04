import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, hashPassword } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { userUpdateSchema } from '@/lib/schemas';

export const PUT = handle(async (req: NextRequest, ctx: { params: Promise<{ uid: string }> }) => {
  const { uid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager');
  const target = await prisma.users.findFirst({ where: { id: uid, tenant_id: user.tenant_id } });
  if (!target) throw new HttpError(404, 'Pengguna tidak ditemukan');
  const data = userUpdateSchema.parse(await readBody(req));
  const patch: any = {};
  if (data.name != null) patch.name = data.name;
  if (data.role != null) patch.role = data.role;
  if (data.active != null) patch.active = data.active;
  if (data.password) patch.password_hash = await hashPassword(data.password);
  await prisma.users.update({ where: { id: uid }, data: patch });
  return { ok: true };
});

export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ uid: string }> }) => {
  const { uid } = await ctx.params;
  const user = await requireRoles(req, 'Owner');
  if (uid === user.id) throw new HttpError(400, 'Tidak bisa menghapus akun sendiri');
  await prisma.users.deleteMany({ where: { id: uid, tenant_id: user.tenant_id } });
  return { ok: true };
});
