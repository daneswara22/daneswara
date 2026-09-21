import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { handle, readBody } from '@/lib/handler';
import { newId } from '@/lib/http';
import { serializeCustomTeeOrder } from '@/lib/serializers';
import { customTeeDraftSchema } from '@/lib/schemas';
import {
  DRAFT_STATUS, countObjects, nextOrderCode, normalizeDesignViews, normalizeSizeItems,
  resolvePublicTenantId,
} from '@/lib/customTeeOrders';

export const dynamic = 'force-dynamic';

/**
 * "Cek Harga" step: persist the current design as a draft BEFORE the customer
 * fills in their contact details, so nothing is lost while the form is open.
 */
export const POST = handle(async (req: NextRequest) => {
  const data = customTeeDraftSchema.parse(await readBody(req));
  const tenantId = await resolvePublicTenantId();
  const views = await normalizeDesignViews(data.design);
  const sizes = normalizeSizeItems(data.size_items, data.size, data.qty);
  const now = new Date();
  const row = await prisma.custom_tee_orders.create({
    data: {
      id: newId(),
      tenant_id: tenantId,
      order_code: await nextOrderCode(tenantId),
      status: DRAFT_STATUS,
      customer_name: '',
      customer_phone: '',
      customer_email: null,
      product_key: data.product_key,
      product_title: data.product_title,
      size: sizes.label,
      size_items_json: JSON.stringify(sizes.items),
      qty: sizes.total,
      color_name: data.color_name,
      color_hex: data.color_hex,
      objects_count: countObjects(views),
      design_json: JSON.stringify({
        views,
        product: { key: data.product_key, title: data.product_title },
        size: sizes.label,
        size_items: sizes.items,
        qty: sizes.total,
        color: { name: data.color_name, hex: data.color_hex },
      }),
      note: data.note || null,
      submitted_at: null,
      created_at: now,
      updated_at: now,
    },
  });
  return serializeCustomTeeOrder(row);
});
