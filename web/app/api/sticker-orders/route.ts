import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { serializeStickerOrder as ser } from '@/lib/stickerSerialize';
import { STICKER_MATERIALS, stickerUnitPrice, stickerTotalPrice } from '@/lib/stickerPricing';

export const dynamic = 'force-dynamic';


/** Daftar pesanan Custom Sticker (dashboard admin). Preview tidak disertakan. */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Kasir');
  const status = (new URL(req.url).searchParams.get('status') || '').trim();
  const where: any = { tenant_id: user.tenant_id };
  if (status) where.status = status;
  const rows = await prisma.sticker_orders.findMany({
    where,
    orderBy: [{ created_at: 'desc' }],
    take: 200,
    select: {
      id: true, order_code: true, status: true, customer_name: true, customer_phone: true,
      material: true, sheets: true, unit_price: true, total_price: true, layout_json: true,
      note: true, pos_order_id: true, created_at: true, updated_at: true,
    },
  });
  return (rows || []).map((r) => ser(r));
});

/** Buat pesanan Custom Sticker baru. Harga dihitung ulang di server. */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Kasir');
  const b = await readBody(req);

  const name = String(b.customer_name || '').trim();
  const phone = String(b.customer_phone || '').trim();
  const material = String(b.material || '').trim().toUpperCase();
  const sheets = Math.floor(Number(b.sheets) || 0);

  if (!name) throw new HttpError(400, 'Nama pelanggan wajib diisi');
  if (!phone) throw new HttpError(400, 'Nomor WhatsApp wajib diisi');
  if (!STICKER_MATERIALS.some((m) => m.value === material)) throw new HttpError(400, 'Bahan tidak valid');
  if (sheets < 1) throw new HttpError(400, 'Jumlah lembar minimal 1');

  const preview = typeof b.preview === 'string' && b.preview.startsWith('data:image') ? b.preview : null;
  if (preview && preview.length > 4_000_000) throw new HttpError(400, 'Preview desain terlalu besar');

  const now = new Date();
  const seq = await prisma.sticker_orders.count({ where: { tenant_id: user.tenant_id } });
  const code = `STK-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${String(seq + 1).padStart(4, '0')}`;

  const row = await prisma.sticker_orders.create({
    data: {
      id: newId(),
      tenant_id: user.tenant_id,
      order_code: code,
      status: 'Baru',
      customer_name: name,
      customer_phone: phone,
      material,
      sheets,
      unit_price: stickerUnitPrice(material, sheets) as any,
      total_price: stickerTotalPrice(material, sheets) as any,
      layout_json: b.layout ? JSON.stringify(b.layout).slice(0, 60000) : null,
      preview_data: preview,
      note: String(b.note || '').slice(0, 2000) || null,
      created_at: now,
      updated_at: now,
    },
  });
  return ser(row);
});
