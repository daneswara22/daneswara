/**
 * Font kustom — ubah nama / aktif-nonaktif / hapus.
 *   PUT    /api/fonts/:id
 *   DELETE /api/fonts/:id
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { storage } from '@/lib/storage';
import { serializeFont } from '@/lib/serializers';
import { ensureFontSchema } from '@/lib/schemaGuard';

const updateSchema = z.object({
  name: z.string().trim().min(2, 'Nama font minimal 2 karakter').max(80).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).max(100000).optional(),
});

async function findFont(id: string, tenantId: string) {
  const row = await prisma.custom_fonts.findUnique({ where: { id } });
  if (!row || row.tenant_id !== tenantId) throw new HttpError(404, 'Font tidak ditemukan');
  return row;
}

export const PUT = handle(async (req: NextRequest, ctx: any) => {
  await ensureFontSchema();
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id } = await ctx.params;
  await findFont(id, user.tenant_id);
  const data = updateSchema.parse(await readBody(req));

  const updated = await prisma.custom_fonts.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
      updated_at: new Date(),
    },
  });
  await logActivity(user.tenant_id, user, 'Ubah Font', updated.name);
  return serializeFont(updated);
});

export const DELETE = handle(async (req: NextRequest, ctx: any) => {
  await ensureFontSchema();
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id } = await ctx.params;
  const existing = await findFont(id, user.tenant_id);
  await storage.delete(existing.file_url).catch(() => {});
  await prisma.custom_fonts.delete({ where: { id } });
  await logActivity(user.tenant_id, user, 'Hapus Font', existing.name);
  return { ok: true, id };
});
