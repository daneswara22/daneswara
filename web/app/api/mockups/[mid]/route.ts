import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { storage } from '@/lib/storage';
import { z } from 'zod';
import { readBody } from '@/lib/handler';
import { serializeMockup } from '@/lib/serializers';

const patchSchema = z.object({
  color_name: z.string().trim().min(1).max(60).optional(),
  sort_order: z.coerce.number().int().min(0).max(100000).optional(),
});

/** Ubah nama tampilan / urutan sebuah mockup. */
export const PATCH = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { mid } = await ctx.params;
  const row = await prisma.custom_mockups.findUnique({ where: { id: mid } });
  if (!row || row.tenant_id !== user.tenant_id) throw new HttpError(404, 'Mockup tidak ditemukan');
  const data = patchSchema.parse(await readBody(req));
  const updated = await prisma.custom_mockups.update({
    where: { id: mid },
    data: {
      ...(data.color_name !== undefined ? { color_name: data.color_name } : {}),
      ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
      updated_at: new Date(),
    },
  });
  await logActivity(user.tenant_id, user, 'Ubah Mockup Produk', `${updated.color_name} · ${updated.view}`);
  return serializeMockup(updated);
});

export const DELETE = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { mid } = await ctx.params;
  const row = await prisma.custom_mockups.findUnique({ where: { id: mid } });
  if (!row || row.tenant_id !== user.tenant_id) throw new HttpError(404, 'Mockup tidak ditemukan');
  if (row.image_url) await storage.delete(row.image_url).catch(() => {});
  await prisma.custom_mockups.delete({ where: { id: mid } });
  await logActivity(user.tenant_id, user, 'Hapus Mockup Kaos', `${row.color_name} · ${row.view}`);
  return { ok: true };
});
