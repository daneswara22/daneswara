/**
 * Satu berkas media.
 *   PUT    /api/mobile-cms/media/:mid   ganti label / URL
 *   DELETE /api/mobile-cms/media/:mid   hapus dari katalog media
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { notFound } from '@/lib/http';
import { ensureMobileCmsSchema, serializeCmsMedia } from '@/lib/mobileCms';

const ROLES = ['Owner', 'Manager'] as const;

async function findOwned(tenantId: string, mid: string) {
  const row = await prisma.mobile_cms_media.findFirst({ where: { id: mid, tenant_id: tenantId } });
  if (!row) notFound('Media tidak ditemukan');
  return row;
}

export const PUT = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const { mid } = await ctx.params;
  const current = await findOwned(user.tenant_id, mid);
  const body = await readBody(req);
  const row = await prisma.mobile_cms_media.update({
    where: { id: mid },
    data: {
      label: body?.label !== undefined ? String(body.label).slice(0, 200) : current.label,
      url: String(body?.url || '').trim() || current.url,
    },
  });
  return serializeCmsMedia(row);
});

export const DELETE = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const { mid } = await ctx.params;
  await findOwned(user.tenant_id, mid);
  await prisma.mobile_cms_media.delete({ where: { id: mid } });
  return { ok: true };
});
