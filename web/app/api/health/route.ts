import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  let dbStatus = 'ok';
  let dbError: string | null = null;
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
  } catch (e: any) {
    dbStatus = 'error';
    dbError = e?.message || String(e);
  }
  return NextResponse.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    database: dbStatus,
    db_error: dbError,
    latency_ms: Date.now() - start,
    ts: new Date().toISOString(),
  });
}
