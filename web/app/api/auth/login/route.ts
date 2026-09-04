import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createAccessToken, publicUser, setAuthCookieHeader, clearAuthCookieHeader } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { loginSchema } from '@/lib/schemas';

export const POST = handle(async (req: NextRequest) => {
  const body = await readBody(req);
  const data = loginSchema.parse(body);
  const uname = data.username.toLowerCase().trim();
  const user = await prisma.users.findUnique({ where: { username: uname } });
  if (!user || !(await verifyPassword(data.password, user.password_hash))) {
    throw new HttpError(401, 'Username atau password salah');
  }
  if (!user.active) throw new HttpError(403, 'Akun dinonaktifkan');
  const token = await createAccessToken(user.id, user.tenant_id, user.role);
  const res = NextResponse.json({ user: publicUser(user), token });
  res.headers.append('Set-Cookie', setAuthCookieHeader(token));
  return res;
});
