/**
 * Produk siap jual untuk ditampilkan di halaman publik.
 * Hanya BACA, hanya produk aktif, dan hanya field yang aman dipublikasikan
 * (tanpa cost, stock, sku, maupun barcode). Tidak mengubah data apa pun.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
  try {
    const rows = await prisma.products.findMany({
      where: { active: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, price: true, image: true, unit: true, description: true },
    });
    return NextResponse.json(
      (rows || []).map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        image: p.image || '',
        unit: p.unit || 'pcs',
        description: p.description || '',
      })),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
