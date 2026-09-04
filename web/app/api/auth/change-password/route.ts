import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { changePasswordSchema } from '@/lib/schemas';

export const POST = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const data = changePasswordSchema.parse(await readBody(req));
  if (data.new_password.length < 6) throw new HttpError(400, 'Password baru minimal 6 karakter');
  const record = await prisma.users.findUnique({ where: { id: user.id } });
  if (!record || !(await verifyPassword(data.current_password, record.password_hash))) {
    throw new HttpError(400, 'Password lama salah');
  }
  await prisma.users.update({ where: { id: user.id }, data: { password_hash: await hashPassword(data.new_password) } });
  return { ok: true };
});
