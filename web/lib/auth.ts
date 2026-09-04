import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { env } from './env';
import { prisma } from './db';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const COOKIE_NAME = 'access_token';

export interface AuthPayload extends JWTPayload {
  sub: string;
  tid: string;
  role: string;
  type: 'access';
}

export interface PublicUser {
  id: string;
  tenant_id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hashed);
  } catch {
    return false;
  }
}

export async function createAccessToken(userId: string, tenantId: string, role: string): Promise<string> {
  return await new SignJWT({ sub: userId, tid: tenantId, role, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_EXPIRE_DAYS}d`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as AuthPayload;
  } catch {
    return null;
  }
}

export function publicUser(user: any): PublicUser {
  return {
    id: user.id,
    tenant_id: user.tenant_id,
    username: user.username,
    name: user.name,
    role: user.role,
    active: user.active,
    created_at: user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at,
  };
}

function extractToken(req: NextRequest, cookieToken?: string): string | null {
  if (cookieToken) return cookieToken;
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  const cookieHeader = req.headers.get('cookie') || '';
  const m = cookieHeader.match(/access_token=([^;]+)/);
  if (m) return m[1];
  return null;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function getCurrentUser(req: NextRequest): Promise<PublicUser> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(COOKIE_NAME)?.value;
  const token = extractToken(req, cookieToken);
  if (!token) throw new AuthError('Tidak terautentikasi', 401);
  const payload = await verifyAccessToken(token);
  if (!payload) throw new AuthError('Token tidak valid atau kadaluarsa', 401);
  const user = await prisma.users.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AuthError('Pengguna tidak ditemukan', 401);
  if (!user.active) throw new AuthError('Akun dinonaktifkan', 403);
  return publicUser(user);
}

export async function requireRoles(req: NextRequest, ...roles: string[]): Promise<PublicUser> {
  const user = await getCurrentUser(req);
  if (roles.length && !roles.includes(user.role)) {
    throw new AuthError('Akses ditolak untuk peran Anda', 403);
  }
  return user;
}

export function setAuthCookieHeader(token: string): string {
  const flags = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${env.JWT_EXPIRE_DAYS * 86400}`,
    env.COOKIE_SECURE ? 'Secure' : '',
    env.COOKIE_SECURE ? 'SameSite=None' : 'SameSite=Lax',
  ].filter(Boolean);
  return flags.join('; ');
}

export function clearAuthCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; ${env.COOKIE_SECURE ? 'Secure; SameSite=None' : 'SameSite=Lax'}`;
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;

export async function logActivity(tenantId: string, user: PublicUser | { id: string; name: string }, action: string, detail: string) {
  try {
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        user_id: user.id || null,
        user_name: user.name || '',
        action,
        detail,
        created_at: new Date(),
      },
    });
  } catch (e) {
    console.error('logActivity failed', e);
  }
}
