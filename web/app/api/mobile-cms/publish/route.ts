/**
 * Publish Changes — menyalin draft menjadi snapshot yang dibaca pelanggan.
 *   GET  /api/mobile-cms/publish   status publikasi terakhir
 *   POST /api/mobile-cms/publish   terapkan draft ke storefront HP
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { toIso } from '@/lib/http';
import { ensureMobileCmsSchema, publishSnapshot, readPublished } from '@/lib/mobileCms';

const ROLES = ['Owner', 'Manager'] as const;

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const row = await prisma.mobile_cms_layout.findUnique({ where: { tenant_id: user.tenant_id } });
  const snap = await readPublished(user.tenant_id);
  return {
    published_at: toIso(row?.published_at),
    has_published: !!snap,
    enabled: !!snap?.enabled,
    product_count: snap?.products?.length || 0,
  };
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const snap = await publishSnapshot(user.tenant_id);
  await logActivity(
    user.tenant_id,
    user,
    'Publish Mobile Platform',
    `${snap.products.length} produk, ${snap.sections.length} section`,
  );
  return {
    ok: true,
    published_at: snap.published_at,
    enabled: snap.enabled,
    product_count: snap.products.length,
  };
});
