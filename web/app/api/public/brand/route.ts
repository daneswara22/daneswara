/**
 * Identitas toko untuk halaman publik (tanpa login).
 *
 * Halaman seperti /price-list perlu menampilkan logo yang sama dengan yang
 * di-upload admin di menu Pengaturan (kolom `settings.logo`), bukan logo
 * bawaan yang ditempel di kode. Endpoint ini sengaja hanya membocorkan dua
 * kolom aman: nama bisnis dan logo.
 *
 *   GET /api/public/brand  ->  { business_name, logo }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handle } from '@/lib/handler';

export const GET = handle(async () => {
  let row: { business_name: string | null; logo: string | null } | null = null;
  try {
    row = await prisma.settings.findFirst({
      select: { business_name: true, logo: true },
      orderBy: { tenant_id: 'asc' },
    });
  } catch {
    row = null; // tabel/baris belum ada -> halaman publik tetap jalan
  }
  const res = NextResponse.json({
    business_name: row?.business_name || null,
    logo: row?.logo || null,
  });
  res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  return res;
});
