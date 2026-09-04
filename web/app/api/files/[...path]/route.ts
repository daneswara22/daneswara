import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { promises as fs } from 'fs';
import path from 'path';
import { env } from '@/lib/env';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const rel = (parts || []).join('/');
  if (!rel) return new NextResponse('Not found', { status: 404 });
  const abs = path.join(env.UPLOAD_DIR, rel);
  try {
    const data = await fs.readFile(abs);
    const ext = path.extname(rel).slice(1).toLowerCase();
    const type = ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
    return new NextResponse(data, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
