/**
 * Font kustom — endpoint admin.
 *   GET  /api/fonts        daftar font milik tenant
 *   POST /api/fonts        unggah font baru (multipart: file + name)
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { storage } from '@/lib/storage';
import { serializeFont } from '@/lib/serializers';
import {
  MAX_FONT_BYTES, ACCEPTED_FONT_EXTS, FONT_GUIDE,
  fontFormatByExt, extFromFilename, familyFromName,
} from '@/lib/fonts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const rows = await prisma.custom_fonts.findMany({
    where: { tenant_id: user.tenant_id },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
  return { items: rows.map(serializeFont), total: rows.length, guide: FONT_GUIDE };
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const rawName = String(form.get('name') || '').trim();

  if (!file || typeof file === 'string') throw new HttpError(400, 'Berkas font wajib dilampirkan');

  const ext = extFromFilename(file.name);
  const fmt = fontFormatByExt(ext);
  if (!fmt) {
    throw new HttpError(400, `Format font tidak didukung. Gunakan ${ACCEPTED_FONT_EXTS.join(', ').toUpperCase()} — WOFF2 paling ideal.`);
  }
  if (file.size <= 0) throw new HttpError(400, 'Berkas font kosong');
  if (file.size > MAX_FONT_BYTES) {
    throw new HttpError(413, `Ukuran font maksimal ${FONT_GUIDE.max_label}. Coba ubah ke WOFF2 supaya lebih ringan.`);
  }

  // nama tampilan: dari input admin, kalau kosong pakai nama berkas
  const name = (rawName || file.name.replace(/\.[a-zA-Z0-9]+$/, '')).slice(0, 80);
  if (name.length < 2) throw new HttpError(400, 'Nama font minimal 2 karakter');

  let family = familyFromName(name);
  for (let i = 2; i < 100; i++) {
    const taken = await prisma.custom_fonts.findFirst({
      where: { tenant_id: user.tenant_id, family },
      select: { id: true },
    });
    if (!taken) break;
    family = `${familyFromName(name)}-${i}`;
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await storage.uploadFont(buf, fmt.ext, fmt.mime);

  const count = await prisma.custom_fonts.count({ where: { tenant_id: user.tenant_id } });
  const now = new Date();
  const created = await prisma.custom_fonts.create({
    data: {
      id: newId(),
      tenant_id: user.tenant_id,
      name,
      family,
      file_url: uploaded.url,
      format: fmt.ext,
      file_size: uploaded.bytes,
      is_active: true,
      sort_order: count * 10,
      created_at: now,
      updated_at: now,
    },
  });
  await logActivity(user.tenant_id, user, 'Tambah Font', `${name} (${fmt.label})`);
  return serializeFont(created);
});
