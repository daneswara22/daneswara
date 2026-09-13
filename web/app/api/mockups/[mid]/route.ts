import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { storage } from '@/lib/storage';

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
