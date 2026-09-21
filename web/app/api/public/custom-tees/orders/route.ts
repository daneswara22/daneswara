import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { serializeCustomTeeOrder } from '@/lib/serializers';
import { customTeeOrderSchema } from '@/lib/schemas';
import {
  DRAFT_STATUS, EMAIL_RE, NEW_STATUS, countObjects, nextOrderCode,
  normalizeDesignViews, normalizeSizeItems, resolvePublicTenantId,
} from '@/lib/customTeeOrders';

export const dynamic = 'force-dynamic';

/**
 * "Kirim Pesanan": promote the draft (or create a fresh record) to a real order
 * with status "Baru". The design payload is NEVER deleted — it stays attached.
 */
export const POST = handle(async (req: NextRequest) => {
  const data = customTeeOrderSchema.parse(await readBody(req));
  const name = (data.customer_name || '').trim();
  const phone = (data.customer_phone || '').trim();
  const email = (data.customer_email || '').trim();
  if (!name) throw new HttpError(400, 'Nama Customer wajib diisi');
  if (!phone) throw new HttpError(400, 'No. yang bisa dihubungi wajib diisi');
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'Format email tidak valid');

  const tenantId = await resolvePublicTenantId();
  const now = new Date();

  const draft = data.draft_id
    ? await prisma.custom_tee_orders.findFirst({ where: { id: data.draft_id, tenant_id: tenantId } })
    : null;

  // Design is only re-normalised when we do not already have a stored draft,
  // or when the client explicitly sends a design payload with the submission.

  let designJson = draft?.design_json || '';
  let objects = draft?.objects_count || 0;
  const sizes = normalizeSizeItems(data.size_items, data.size, data.qty);
  if (!draft || data.design) {
    const views = await normalizeDesignViews(data.design || {});
    objects = countObjects(views);
    designJson = JSON.stringify({
      views,
      product: { key: data.product_key, title: data.product_title },
      size: sizes.label,
      size_items: sizes.items,
      qty: sizes.total,
      color: { name: data.color_name, hex: data.color_hex },
    });
  } else if (designJson) {
    // draft sudah menyimpan desain: cukup segarkan ringkasan ukuran/jumlah.
    try {
      const parsed = JSON.parse(designJson);
      parsed.size = sizes.label;
      parsed.size_items = sizes.items;
      parsed.qty = sizes.total;
      designJson = JSON.stringify(parsed);
    } catch { /* biarkan apa adanya */ }
  }

  const payload = {
    status: NEW_STATUS,
    customer_name: name,
    customer_phone: phone,
    customer_email: email || null,
    product_key: data.product_key,
    product_title: data.product_title,
    size: sizes.label,
    size_items_json: JSON.stringify(sizes.items),
    qty: sizes.total,
    color_name: data.color_name,
    color_hex: data.color_hex,
    objects_count: objects,
    design_json: designJson,
    note: (data.note || '').trim() || null,
    submitted_at: now,
    updated_at: now,
  };

  const row = draft && draft.status === DRAFT_STATUS
    ? await prisma.custom_tee_orders.update({ where: { id: draft.id }, data: payload })
    : await prisma.custom_tee_orders.create({
        data: {
          id: newId(),
          tenant_id: tenantId,
          order_code: await nextOrderCode(tenantId),
          created_at: now,
          ...payload,
        },
      });

  return serializeCustomTeeOrder(row);
});
