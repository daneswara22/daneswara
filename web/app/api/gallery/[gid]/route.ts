import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { storage } from '@/lib/storage';
import { galleryInputSchema } from '@/lib/schemas';
import { serializeGallery } from '@/lib/serializers';

export const PUT = handle(async (req: NextRequest, ctx: { params: Promise<{ gid: string }> }) => {
  const { gid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager');
  const g = await prisma.gallery_items.findFirst({ where: { id: gid, tenant_id: user.tenant_id } });
  if (!g) throw new HttpError(404, 'Foto tidak ditemukan');
  const data = galleryInputSchema.parse(await readBody(req));
  if (!data.src.trim() || !data.label.trim()) throw new HttpError(400, 'Gambar dan label wajib diisi');
  const src = await storage.normalizeImageField(data.src.trim(), 'gallery');
  if (g.src && src !== g.src) await storage.delete(g.src);
  const updated = await prisma.gallery_items.update({
    where: { id: gid },
    data: {
      src, label: data.label.trim(),
      tag: (data.tag || '').trim(), span: data.span || '', sort_order: data.sort_order || 0,
    },
  });
  return serializeGallery(updated);
});

export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ gid: string }> }) => {
  const { gid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager');
  const g = await prisma.gallery_items.findFirst({ where: { id: gid, tenant_id: user.tenant_id } });
  if (g) {
    await storage.delete(g.src);
    await logActivity(user.tenant_id, user, 'Hapus Foto Galeri', g.label);
    await prisma.gallery_items.delete({ where: { id: gid } });
  }
  return { ok: true };
});
