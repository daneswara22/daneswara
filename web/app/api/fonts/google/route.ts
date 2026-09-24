/**
 * Font dari Google Fonts — tanpa mengunduh berkas.
 *   GET  /api/fonts/google    katalog pilihan populer (tanpa API key)
 *   POST /api/fonts/google    tambah font Google ke daftar font tenant
 *
 * Yang disimpan hanya nama family + URL CSS resmi Google. Berkas font tetap
 * dimuat browser pelanggan langsung dari CDN Google, jadi tidak ada unggahan
 * ke R2 sama sekali.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { serializeFont } from '@/lib/serializers';
import { ensureFontSchema } from '@/lib/schemaGuard';
import {
  GOOGLE_FONT_CATALOG, GOOGLE_FONT_CATEGORIES, GOOGLE_FONT_GUIDE,
  GOOGLE_FONT_FORMAT, googleCssUrl, normalizeGoogleFamily, verifyGoogleFamily,
} from '@/lib/googleFonts';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  family: z.string().trim().min(2, 'Nama font Google minimal 2 karakter').max(60),
  name: z.string().trim().max(80).optional(),
});

/** Katalog untuk picker admin (dipakai juga untuk pratinjau). */
export const GET = handle(async (req: NextRequest) => {
  await ensureFontSchema();
  const user = await getCurrentUser(req);
  const rows = await prisma.custom_fonts.findMany({
    where: { tenant_id: user.tenant_id, format: GOOGLE_FONT_FORMAT },
    select: { family: true },
  });
  const taken = new Set(rows.map((r) => r.family));
  return {
    items: GOOGLE_FONT_CATALOG.map((f) => ({
      ...f,
      added: taken.has(f.family),
      css_url: googleCssUrl([f.family]),
    })),
    categories: GOOGLE_FONT_CATEGORIES,
    preview_css_url: googleCssUrl(GOOGLE_FONT_CATALOG.map((f) => f.family)),
    guide: GOOGLE_FONT_GUIDE,
    total: GOOGLE_FONT_CATALOG.length,
  };
});

export const POST = handle(async (req: NextRequest) => {
  await ensureFontSchema();
  const user = await requireRoles(req, 'Owner', 'Manager');
  const body = createSchema.parse(await readBody(req));

  const family = normalizeGoogleFamily(body.family);
  const check = await verifyGoogleFamily(family);
  if (!check.ok) {
    throw new HttpError(
      400,
      `Font "${family}" tidak ditemukan di Google Fonts. Cek ejaan nama family-nya (contoh: "Bebas Neue").`,
    );
  }

  const exists = await prisma.custom_fonts.findFirst({
    where: { tenant_id: user.tenant_id, family: check.family },
    select: { id: true },
  });
  if (exists) throw new HttpError(409, `Font "${check.family}" sudah ada di daftar.`);

  const name = (body.name?.trim() || check.family).slice(0, 80);
  const count = await prisma.custom_fonts.count({ where: { tenant_id: user.tenant_id } });
  const now = new Date();
  const created = await prisma.custom_fonts.create({
    data: {
      id: newId(),
      tenant_id: user.tenant_id,
      name,
      family: check.family,
      file_url: check.css_url, // URL CSS Google, bukan berkas di R2
      format: GOOGLE_FONT_FORMAT,
      file_size: 0,
      is_active: true,
      sort_order: count * 10,
      created_at: now,
      updated_at: now,
    },
  });
  await logActivity(user.tenant_id, user, 'Tambah Font', `${name} (Google Fonts)`);
  return serializeFont(created);
});
