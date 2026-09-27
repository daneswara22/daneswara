/**
 * Berkas mockup disajikan same-origin.
 *   GET /api/public/mockups/:id/file
 *
 * Dipakai desainer /custom supaya gambar mockup bisa dipakai sebagai CSS
 * mask-image (pewarnaan mengikuti palet). URL R2/CDN mentah terhalang CORS
 * saat dipakai sebagai mask, jadi selalu lewat proxy ini.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = await prisma.custom_mockups.findUnique({ where: { id } });
  if (!row?.image_url) return new NextResponse('Not found', { status: 404 });

  const bytes = await storage.fetchBytes(row.image_url).catch(() => null);
  if (!bytes) {
    // Fallback: arahkan ke URL aslinya kalau berkas tidak bisa dibaca server.
    return NextResponse.redirect(row.image_url, 302);
  }

  const url = row.image_url.toLowerCase();
  const type = url.endsWith('.png')
    ? 'image/png'
    : url.endsWith('.jpg') || url.endsWith('.jpeg')
      ? 'image/jpeg'
      : 'image/webp';

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
