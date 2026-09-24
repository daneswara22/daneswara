/**
 * Sajikan berkas font dari storage lewat origin kita sendiri.
 *   GET /api/public/fonts/:id/file
 *
 * Kenapa tidak langsung memakai URL R2/CDN? Karena browser mewajibkan header
 * CORS untuk berkas font yang dimuat @font-face. Dengan menyajikannya dari
 * origin yang sama, font selalu berhasil dimuat tanpa perlu mengatur CORS di
 * bucket. Respons di-cache lama karena berkasnya immutable (nama unik per
 * unggahan).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { fontFormatByExt } from '@/lib/fonts';
import { ensureFontSchema } from '@/lib/schemaGuard';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await ensureFontSchema();
  const { id } = await ctx.params;
  const row = await prisma.custom_fonts.findUnique({ where: { id } });
  if (!row || !row.is_active) return new NextResponse('Not found', { status: 404 });
  // Font Google tidak punya berkas di storage — arahkan ke CSS resmi Google.
  if (row.format === 'google') return NextResponse.redirect(row.file_url, 302);

  const bytes = await storage.fetchBytes(row.file_url);
  if (!bytes) return new NextResponse('Not found', { status: 404 });

  const mime = fontFormatByExt(row.format)?.mime || 'application/octet-stream';
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
