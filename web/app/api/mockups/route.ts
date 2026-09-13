import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { storage } from '@/lib/storage';
import { serializeMockup } from '@/lib/serializers';

const ALLOWED_VIEWS = ['front', 'back', 'left', 'right', 'label'] as const;

const inputSchema = z.object({
  product_key: z.string().trim().min(1).max(80),
  view: z.enum(ALLOWED_VIEWS),
  color_hex: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/i, 'Format warna harus #RRGGBB'),
  color_name: z.string().trim().min(1).max(60),
  image: z.string().trim().min(20, 'Gambar wajib diisi'),
  sort_order: z.number().int().optional(),
});

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const url = new URL(req.url);
  const productKey = url.searchParams.get('product_key') || undefined;
  const rows = await prisma.custom_mockups.findMany({
    where: {
      tenant_id: user.tenant_id,
      ...(productKey ? { product_key: productKey } : {}),
    },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
  return (rows || []).map(serializeMockup);
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const body = await readBody(req);
  const data = inputSchema.parse(body);

  const colorHex = data.color_hex.toUpperCase();
  const raw = data.image.startsWith('data:image')
    ? await storage.uploadDataUri(data.image, 'mockup')
    : data.image;
  if (!raw) throw new HttpError(400, 'Gagal memproses gambar (format tidak valid)');

  // Existing row? => replace image + delete old file
  const existing = await prisma.custom_mockups.findFirst({
    where: {
      tenant_id: user.tenant_id,
      product_key: data.product_key,
      color_hex: colorHex,
      view: data.view,
    },
  });

  // We only have URL string from uploadDataUri; derive key for future deletion
  const newKey = storage.keyFromUrl(raw) || '';

  if (existing) {
    if (existing.image_url && existing.image_url !== raw) {
      await storage.delete(existing.image_url).catch(() => {});
    }
    const updated = await prisma.custom_mockups.update({
      where: { id: existing.id },
      data: {
        color_name: data.color_name.trim(),
        image_url: raw,
        image_key: newKey || existing.image_key,
        sort_order: data.sort_order ?? existing.sort_order,
        updated_at: new Date(),
      },
    });
    await logActivity(user.tenant_id, user, 'Update Mockup Kaos', `${data.color_name} · ${data.view}`);
    return serializeMockup(updated);
  }

  const now = new Date();
  const created = await prisma.custom_mockups.create({
    data: {
      id: newId(),
      tenant_id: user.tenant_id,
      product_key: data.product_key.trim(),
      view: data.view,
      color_hex: colorHex,
      color_name: data.color_name.trim(),
      image_url: raw,
      image_key: newKey,
      sort_order: data.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    },
  });
  await logActivity(user.tenant_id, user, 'Tambah Mockup Kaos', `${data.color_name} · ${data.view}`);
  return serializeMockup(created);
});
