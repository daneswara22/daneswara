/**
 * Media / Product Images Manager.
 *   GET   /api/mobile-cms/media           daftar media
 *   POST  /api/mobile-cms/media           catat URL hasil /api/upload (bisa banyak)
 *   PATCH /api/mobile-cms/media           simpan urutan
 *
 * Berkas gambarnya sendiri tetap diunggah lewat endpoint existing
 * POST /api/upload?kind=product (sharp -> WebP -> Cloudflare R2). Di sini kita
 * hanya menyimpan katalog URL-nya supaya bisa dipakai ulang antar produk.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { newId, badRequest } from '@/lib/http';
import { ensureMobileCmsSchema, serializeCmsMedia } from '@/lib/mobileCms';

const ROLES = ['Owner', 'Manager'] as const;

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const rows = await prisma.mobile_cms_media.findMany({
    where: { tenant_id: user.tenant_id },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
  });
  return { items: rows.map(serializeCmsMedia) };
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const body = await readBody(req);
  const incoming = Array.isArray(body?.items) ? body.items : [body];
  const clean = incoming
    .map((it: any) => ({
      url: String(it?.url || '').trim(),
      label: String(it?.label || '').slice(0, 200),
      width: Math.max(0, Math.floor(Number(it?.width) || 0)),
      height: Math.max(0, Math.floor(Number(it?.height) || 0)),
    }))
    .filter((it: any) => it.url);
  if (!clean.length) badRequest('URL gambar wajib diisi');

  const base = await prisma.mobile_cms_media.count({ where: { tenant_id: user.tenant_id } });
  const now = new Date();
  await prisma.mobile_cms_media.createMany({
    data: clean.map((it: any, i: number) => ({
      id: newId(),
      tenant_id: user.tenant_id,
      url: it.url,
      label: it.label,
      width: it.width,
      height: it.height,
      sort_order: base + i,
      created_at: now,
    })),
  });
  const rows = await prisma.mobile_cms_media.findMany({
    where: { tenant_id: user.tenant_id },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
  });
  return { items: rows.map(serializeCmsMedia) };
});

export const PATCH = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const body = await readBody(req);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  if (!ids.length) badRequest('Daftar urutan kosong');
  const owned = await prisma.mobile_cms_media.findMany({
    where: { tenant_id: user.tenant_id, id: { in: ids } },
    select: { id: true },
  });
  const allowed = new Set(owned.map((o) => o.id));
  await prisma.$transaction(
    ids
      .filter((id) => allowed.has(id))
      .map((id, i) => prisma.mobile_cms_media.update({ where: { id }, data: { sort_order: i } })),
  );
  return { ok: true };
});
