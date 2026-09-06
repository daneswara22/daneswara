import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { storage } from '@/lib/storage';
import { galleryInputSchema } from '@/lib/schemas';
import { serializeGallery } from '@/lib/serializers';

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const rows = await prisma.gallery_items.findMany({
    where: { tenant_id: user.tenant_id },
    orderBy: [{ sort_order: 'desc' }, { created_at: 'desc' }],
  });
  return (rows || []).map(serializeGallery);
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const data = galleryInputSchema.parse(await readBody(req));
  if (!data.src.trim() || !data.label.trim()) throw new HttpError(400, 'Gambar dan label wajib diisi');
  const src = await storage.normalizeImageField(data.src.trim(), 'gallery');
  let sortOrder = data.sort_order || 0;
  if (!sortOrder) {
    const top = await prisma.gallery_items.findFirst({
      where: { tenant_id: user.tenant_id },
      orderBy: { sort_order: 'desc' },
      select: { sort_order: true },
    });
    sortOrder = (top?.sort_order || 0) + 1;
  }
  const g = await prisma.gallery_items.create({
    data: {
      id: newId(), tenant_id: user.tenant_id, src, label: data.label.trim(),
      tag: (data.tag || '').trim(), span: data.span || '',
      sort_order: sortOrder, created_at: new Date(),
    },
  });
  await logActivity(user.tenant_id, user, 'Tambah Foto Galeri', g.label);
  return serializeGallery(g);
});
