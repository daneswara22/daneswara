/**
 * Daftar font aktif untuk desainer kaos publik (/custom).
 * Tidak butuh login. `file_href` sudah berupa URL same-origin sehingga bisa
 * langsung dipakai di aturan @font-face tanpa masalah CORS.
 *   GET /api/public/fonts
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handle } from '@/lib/handler';
import { serializeFont } from '@/lib/serializers';
import { ensureFontSchema } from '@/lib/schemaGuard';

export const GET = handle(async () => {
  await ensureFontSchema();
  const rows = await prisma.custom_fonts.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
  const res = NextResponse.json({
    items: rows.map((r) => serializeFont(r, { publicOnly: true })),
    total: rows.length,
  });
  res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  return res;
});
