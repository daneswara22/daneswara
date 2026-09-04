import { NextResponse } from 'next/server';
import { clearAuthCookieHeader } from '@/lib/auth';
import { handle } from '@/lib/handler';

export const POST = handle(async () => {
  const res = NextResponse.json({ ok: true });
  res.headers.append('Set-Cookie', clearAuthCookieHeader());
  return res;
});
