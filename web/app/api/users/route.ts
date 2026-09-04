import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, hashPassword, logActivity, publicUser } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { userCreateSchema } from '@/lib/schemas';

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const rows = await prisma.users.findMany({ where: { tenant_id: user.tenant_id }, orderBy: { created_at: 'asc' } });
  return rows.map(publicUser);
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const data = userCreateSchema.parse(await readBody(req));
  const uname = data.username.toLowerCase().trim();
  const exists = await prisma.users.findUnique({ where: { username: uname } });
  if (exists) throw new HttpError(400, 'Username sudah digunakan');
  const created = await prisma.users.create({
    data: {
      id: newId(), tenant_id: user.tenant_id, username: uname,
      password_hash: await hashPassword(data.password), name: data.name, role: data.role, active: true,
      created_at: new Date(),
    },
  });
  await logActivity(user.tenant_id, user, 'Tambah Pengguna', `${data.name} (${data.role})`);
  const out: any = publicUser(created);
  out.password_hash = null;
  return out;
});
