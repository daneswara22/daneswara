/**
 * Kategori storefront HP.
 *   GET   /api/mobile-cms/categories
 *   POST  /api/mobile-cms/categories
 *   PATCH /api/mobile-cms/categories   simpan urutan
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { newId, badRequest } from '@/lib/http';
import { ensureMobileCmsSchema, serializeCmsCategory } from '@/lib/mobileCms';

const ROLES = ['Owner', 'Manager'] as const;

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const rows = await prisma.mobile_cms_categories.findMany({
    where: { tenant_id: user.tenant_id, deleted_at: null },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
  return { items: rows.map(serializeCmsCategory) };
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const body = await readBody(req);
  const name = String(body?.name || '').trim();
  if (!name) badRequest('Nama kategori wajib diisi');
  const count = await prisma.mobile_cms_categories.count({
    where: { tenant_id: user.tenant_id, deleted_at: null },
  });
  const now = new Date();
  const row = await prisma.mobile_cms_categories.create({
    data: {
      id: newId(),
      tenant_id: user.tenant_id,
      name: name.slice(0, 160),
      image: String(body?.image || ''),
      is_active: body?.is_active === undefined ? true : !!body.is_active,
      sort_order: count,
      created_at: now,
      updated_at: now,
    },
  });
  return serializeCmsCategory(row);
});

export const PATCH = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const body = await readBody(req);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  if (!ids.length) badRequest('Daftar urutan kosong');
  const owned = await prisma.mobile_cms_categories.findMany({
    where: { tenant_id: user.tenant_id, id: { in: ids } },
    select: { id: true },
  });
  const allowed = new Set(owned.map((o) => o.id));
  await prisma.$transaction(
    ids
      .filter((id) => allowed.has(id))
      .map((id, i) =>
        prisma.mobile_cms_categories.update({
          where: { id },
          data: { sort_order: i, updated_at: new Date() },
        }),
      ),
  );
  return { ok: true };
});
