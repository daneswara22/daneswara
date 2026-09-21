import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { storage } from '@/lib/storage';

const VIEWS = ['Depan', 'Belakang', 'Lengan Kiri', 'Lengan Kanan'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Walk the design and move any inline base64 image (data URI) into storage,
// replacing it with a stable URL. This preserves the COMPLETE design (position,
// size, rotation, text, clipart, layer order) while keeping the DB row small.
async function persistDesignImages(design: any) {
  if (!design || typeof design !== 'object') return design;
  const views = design.views && typeof design.views === 'object' ? design.views : {};
  for (const v of VIEWS) {
    const layers = Array.isArray(views[v]) ? views[v] : [];
    for (const l of layers) {
      if (l && typeof l.src === 'string' && l.src.startsWith('data:image')) {
        try {
          const url = await storage.uploadDataUri(l.src, 'custom-tees');
          if (url) l.src = url;
        } catch {
          /* keep original src if upload fails */
        }
      }
    }
  }
  return design;
}

function serialize(o: any) {
  return {
    id: o.id,
    order_code: o.order_code,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    customer_email: o.customer_email || '',
    product_name: o.product_name,
    shirt_size: o.shirt_size,
    color_name: o.color_name,
    color_hex: o.color_hex,
    status: o.status,
    seen: !!o.seen,
    note: o.note || '',
    created_at: o.created_at instanceof Date ? o.created_at.toISOString() : o.created_at,
    updated_at: o.updated_at instanceof Date ? o.updated_at.toISOString() : o.updated_at,
  };
}

// GET — list orders (design excluded to keep payload light) + new_count badge value.
export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const tid = user.tenant_id;
  const rows = await prisma.custom_tees_orders.findMany({
    where: { tenant_id: tid },
    orderBy: { created_at: 'desc' },
    take: 500,
  });
  const new_count = rows.filter((r: any) => r.status === 'Baru').length;
  return { orders: rows.map(serialize), new_count };
});

// POST — create a Custom Tees order from the current design (authenticated tenant).
export const POST = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const tid = user.tenant_id;
  const body = await readBody(req);

  const customer_name = String(body.customer_name || '').trim();
  const customer_phone = String(body.customer_phone || '').trim();
  const customer_email = String(body.customer_email || '').trim();
  if (!customer_name) throw new HttpError(400, 'Nama Customer wajib diisi');
  if (!customer_phone) throw new HttpError(400, 'No. yang bisa dihubungi wajib diisi');
  if (customer_email && !EMAIL_RE.test(customer_email)) throw new HttpError(400, 'Format email tidak valid');

  const design = await persistDesignImages(body.design || {});
  const color = (design && design.color) || {};
  const product_name = String((design && design.product) || body.product_name || 'Custom Tees').slice(0, 200);
  const shirt_size = String((design && design.size) || body.shirt_size || '-').slice(0, 20);

  const now = new Date();
  const count = await prisma.custom_tees_orders.count({ where: { tenant_id: tid } });
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const order_code = `CT-${y}${m}${d}-${String(count + 1).padStart(4, '0')}`;

  const created = await prisma.custom_tees_orders.create({
    data: {
      id: newId(),
      tenant_id: tid,
      order_code,
      customer_name: customer_name.slice(0, 160),
      customer_phone: customer_phone.slice(0, 60),
      customer_email: customer_email ? customer_email.slice(0, 160) : null,
      product_name,
      shirt_size,
      color_name: String(color.name || '-').slice(0, 60),
      color_hex: String(color.hex || '#ffffff').slice(0, 20),
      design: JSON.stringify(design),
      status: 'Baru',
      seen: false,
      note: body.note ? String(body.note).slice(0, 500) : null,
      created_at: now,
      updated_at: now,
    },
  });

  return { ok: true, id: created.id, order_code: created.order_code };
});
