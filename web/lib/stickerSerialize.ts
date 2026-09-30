/** Serializer pesanan Custom Sticker (dipakai beberapa route). */
export const serializeStickerOrder = (r: any, withPreview = false) => ({
  id: r.id,
  order_code: r.order_code,
  status: r.status,
  customer_name: r.customer_name,
  customer_phone: r.customer_phone,
  material: r.material,
  sheets: r.sheets,
  unit_price: Number(r.unit_price),
  total_price: Number(r.total_price),
  layout: (() => { try { return JSON.parse(r.layout_json || 'null'); } catch { return null; } })(),
  note: r.note || '',
  pos_order_id: r.pos_order_id || null,
  ...(withPreview ? { preview: r.preview_data || null } : {}),
  created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
  updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
});
