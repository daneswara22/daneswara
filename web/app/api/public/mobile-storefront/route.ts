/**
 * Storefront HP yang dilihat pelanggan (tanpa login).
 *   GET /api/public/mobile-storefront
 *
 * Hanya membaca SNAPSHOT hasil Publish. Kalau admin belum pernah publish atau
 * tombol "Aktifkan storefront CMS" masih mati, endpoint ini balas
 * { enabled: false } dan halaman HP memakai tampilan lama tanpa perubahan.
 */
import { NextResponse } from 'next/server';
import { handle } from '@/lib/handler';
import { readPublishedPublic } from '@/lib/mobileCms';

export const GET = handle(async () => {
  const snap = await readPublishedPublic();
  const body =
    snap && snap.enabled
      ? snap
      : { enabled: false, settings: null, sections: [], categories: [], products: [] };
  const res = NextResponse.json(body);
  res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
  return res;
});
