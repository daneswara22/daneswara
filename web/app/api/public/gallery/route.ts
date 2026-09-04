import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { serializePublicGallery } from '@/lib/serializers';
import { errorResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
  try {
    const rows = await prisma.gallery_items.findMany({
      orderBy: [{ sort_order: 'desc' }, { created_at: 'desc' }],
    });
    return NextResponse.json(rows.map(serializePublicGallery));
  } catch (e) {
    return errorResponse(e);
  }
}
