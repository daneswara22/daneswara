/**
 * Mobile Platform Management — produk CMS.
 *   GET    /api/mobile-cms/products        daftar (dengan search/filter/sort)
 *   POST   /api/mobile-cms/products        tambah produk
 *   PATCH  /api/mobile-cms/products        simpan urutan (drag & drop)
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { newId, badRequest } from '@/lib/http';
import { ensureMobileCmsSchema, serializeCmsProduct, productPayload } from '@/lib/mobileCms';

const ROLES = ['Owner', 'Manager'] as const;

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const status = url.searchParams.get('status') || '';
  const category = url.searchParams.get('category') || '';
  const sort = url.searchParams.get('sort') || 'manual';

  const rows = await prisma.mobile_cms_products.findMany({
    where: { tenant_id: user.tenant_id, deleted_at: null },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
  let items = rows.map(serializeCmsProduct);

  if (q) {
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q),
    );
  }
  if (status) items = items.filter((p) => p.status === status);
  if (category) items = items.filter((p) => p.category_id === category);

  const cmp: Record<string, (a: any, b: any) => number> = {
    newest: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    oldest: (a, b) => String(a.created_at).localeCompare(String(b.created_at)),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    name_asc: (a, b) => a.name.localeCompare(b.name, 'id'),
    name_desc: (a, b) => b.name.localeCompare(a.name, 'id'),
  };
  if (cmp[sort]) items = [...items].sort(cmp[sort]);

  return { items, total: items.length };
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const data = productPayload(await readBody(req));
  const count = await prisma.mobile_cms_products.count({
    where: { tenant_id: user.tenant_id, deleted_at: null },
  });
  const now = new Date();
  const row = await prisma.mobile_cms_products.create({
    data: {
      id: newId(),
      tenant_id: user.tenant_id,
      ...data,
      sort_order: count,
      created_at: now,
      updated_at: now,
    },
  });
  await logActivity(user.tenant_id, user, 'Tambah Produk Mobile', data.name);
  return serializeCmsProduct(row);
});

export const PATCH = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const body = await readBody(req);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  if (!ids.length) badRequest('Daftar urutan kosong');
  const owned = await prisma.mobile_cms_products.findMany({
    where: { tenant_id: user.tenant_id, id: { in: ids } },
    select: { id: true },
  });
  const allowed = new Set(owned.map((o) => o.id));
  await prisma.$transaction(
    ids
      .filter((id) => allowed.has(id))
      .map((id, i) =>
        prisma.mobile_cms_products.update({
          where: { id },
          data: { sort_order: i, updated_at: new Date() },
        }),
      ),
  );
  return { ok: true, count: allowed.size };
});
