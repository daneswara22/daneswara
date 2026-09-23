// Serializers - convert Prisma rows into JSON shape identical to FastAPI SerializerMixin.to_dict()
import { toIso, safeJson } from './http';

export function serializeUser(u: any) {
  return {
    id: u.id,
    tenant_id: u.tenant_id,
    username: u.username,
    name: u.name,
    role: u.role,
    active: u.active,
    created_at: toIso(u.created_at),
  };
}

export function serializeCategory(c: any) {
  return {
    id: c.id,
    tenant_id: c.tenant_id,
    name: c.name,
    color: c.color,
    image: c.image,
    sort_order: c.sort_order,
    created_at: toIso(c.created_at),
  };
}

export function serializeProduct(p: any) {
  return {
    id: p.id,
    tenant_id: p.tenant_id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    category_id: p.category_id,
    price: p.price,
    cost: p.cost,
    stock: p.stock,
    min_stock: p.min_stock,
    unit: p.unit,
    image: p.image,
    description: p.description,
    active: p.active,
    sort_order: p.sort_order,
    created_at: toIso(p.created_at),
  };
}

export function serializeCustomer(c: any) {
  return {
    id: c.id,
    tenant_id: c.tenant_id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    total_spent: c.total_spent,
    visits: c.visits,
    created_at: toIso(c.created_at),
  };
}

export function serializeSupplier(s: any) {
  return {
    id: s.id,
    tenant_id: s.tenant_id,
    name: s.name,
    phone: s.phone,
    email: s.email,
    address: s.address,
    created_at: toIso(s.created_at),
  };
}

export function serializeStockMovement(m: any) {
  return {
    id: m.id,
    tenant_id: m.tenant_id,
    product_id: m.product_id,
    product_name: m.product_name,
    type: m.type,
    qty: m.qty,
    before: m.before,
    after: m.after,
    note: m.note,
    user_name: m.user_name,
    created_at: toIso(m.created_at),
  };
}

export function serializeSale(s: any) {
  return {
    id: s.id,
    tenant_id: s.tenant_id,
    invoice: s.invoice,
    items: safeJson(s.items, []),
    subtotal: s.subtotal,
    discount: s.discount,
    tax_rate: s.tax_rate,
    tax: s.tax,
    total: s.total,
    cost: s.cost,
    profit: s.profit,
    payment_method: s.payment_method,
    paid_amount: s.paid_amount,
    change: s.change,
    customer_name: s.customer_name,
    customer_id: s.customer_id,
    customer_phone: s.customer_phone,
    channel: s.channel,
    from_order: s.from_order,
    cashier: s.cashier,
    cashier_id: s.cashier_id,
    refunded: s.refunded,
    refunded_at: toIso(s.refunded_at),
    created_at: toIso(s.created_at),
  };
}

export function serializeOrder(o: any) {
  return {
    id: o.id,
    tenant_id: o.tenant_id,
    order_number: o.order_number,
    customer_id: o.customer_id,
    customer_name: o.customer_name,
    items: safeJson(o.items, []),
    subtotal: o.subtotal,
    discount: o.discount,
    tax_rate: o.tax_rate,
    tax: o.tax,
    total: o.total,
    deposit_amount: o.deposit_amount,
    deposit_method: o.deposit_method,
    remaining: o.remaining,
    note: o.note,
    order_type: o.order_type,
    channel: o.channel,
    status: o.status,
    cashier: o.cashier,
    invoice: o.invoice,
    payment_method: o.payment_method,
    settle_paid: o.settle_paid,
    completed_at: toIso(o.completed_at),
    created_at: toIso(o.created_at),
  };
}

export function serializePurchase(p: any) {
  return {
    id: p.id,
    tenant_id: p.tenant_id,
    po_number: p.po_number,
    supplier_id: p.supplier_id,
    supplier_name: p.supplier_name,
    items: safeJson(p.items, []),
    total: p.total,
    note: p.note,
    customer_name: p.customer_name,
    order_id: p.order_id,
    order_number: p.order_number,
    status: p.status,
    cashier: p.cashier,
    received_at: toIso(p.received_at),
    created_at: toIso(p.created_at),
  };
}

export function serializeHeldOrder(h: any) {
  return {
    id: h.id,
    tenant_id: h.tenant_id,
    label: h.label,
    items: safeJson(h.items, []),
    discount: h.discount,
    cashier: h.cashier,
    created_at: toIso(h.created_at),
  };
}

export function serializeExpense(e: any) {
  return {
    id: e.id,
    tenant_id: e.tenant_id,
    category: e.category,
    amount: e.amount,
    note: e.note,
    source: e.source || 'Tunai',
    date: e.date instanceof Date ? e.date.toISOString().slice(0, 10) : String(e.date).slice(0, 10),
    user_name: e.user_name,
    created_at: toIso(e.created_at),
  };
}

export function serializeOtherIncome(o: any) {
  return {
    id: o.id,
    tenant_id: o.tenant_id,
    category: o.category,
    amount: o.amount,
    note: o.note,
    source: o.source || 'Tunai',
    date: o.date instanceof Date ? o.date.toISOString().slice(0, 10) : String(o.date).slice(0, 10),
    user_name: o.user_name,
    created_at: toIso(o.created_at),
  };
}

export function serializeFinanceCategory(f: any) {
  return {
    id: f.id,
    tenant_id: f.tenant_id,
    type: f.type,
    name: f.name,
    created_at: toIso(f.created_at),
  };
}

export function serializeSettings(s: any) {
  if (!s) return null;
  return {
    tenant_id: s.tenant_id,
    business_name: s.business_name,
    address: s.address,
    phone: s.phone,
    currency: s.currency,
    tax_rate: s.tax_rate,
    receipt_footer: s.receipt_footer,
    logo: s.logo,
    print_mode: s.print_mode,
    paper_width: s.paper_width,
    printers: safeJson(s.printers, null),
    active_printer: s.active_printer,
  };
}

export function serializeUserSettings(u: any) {
  if (!u) return null;
  return {
    id: u.id,
    tenant_id: u.tenant_id,
    user_id: u.user_id,
    print_mode: u.print_mode,
    paper_width: u.paper_width,
    printers: safeJson(u.printers, null),
    active_printer: u.active_printer,
  };
}

export function serializeActivity(a: any) {
  return {
    id: a.id,
    tenant_id: a.tenant_id,
    user_id: a.user_id,
    user_name: a.user_name,
    action: a.action,
    detail: a.detail,
    created_at: toIso(a.created_at),
  };
}

export function serializeGallery(g: any) {
  return {
    id: g.id,
    src: g.src,
    label: g.label,
    tag: g.tag || '',
    span: g.span || '',
    sort_order: g.sort_order || 0,
    created_at: toIso(g.created_at),
  };
}

export function serializePublicGallery(g: any) {
  return {
    id: g.id,
    src: g.src,
    label: g.label,
    tag: g.tag || '',
    span: g.span || '',
    sort_order: g.sort_order || 0,
  };
}

export function serializeMockup(m: any) {
  return {
    id: m.id,
    product_key: m.product_key,
    view: m.view,
    color_hex: m.color_hex,
    color_name: m.color_name,
    image_url: m.image_url,
    width: m.width || 0,
    height: m.height || 0,
    bytes: m.bytes || 0,
    sort_order: m.sort_order || 0,
    created_at: toIso(m.created_at),
    updated_at: toIso(m.updated_at),
  };
}

/**
 * Font kustom. `file_href` selalu URL same-origin (bukan URL R2 mentah) supaya
 * aturan @font-face di browser tidak terhalang CORS.
 */
export function serializeFont(f: any, opts: { publicOnly?: boolean } = {}) {
  const base = {
    id: f.id,
    name: f.name || '',
    family: f.family || '',
    format: f.format || '',
    file_href: `/api/public/fonts/${f.id}/file`,
    file_size: Number(f.file_size || 0),
    is_active: f.is_active !== false,
    sort_order: f.sort_order || 0,
  };
  if (opts.publicOnly) return base;
  return {
    ...base,
    created_at: toIso(f.created_at),
    updated_at: toIso(f.updated_at),
  };
}

export function serializeProductColor(c: any) {
  return {
    id: c.id,
    product_id: c.product_id,
    name: c.name || '',
    hex: (c.hex || '').toUpperCase(),
    thumb_url: c.thumb_url || '',
    sort_order: c.sort_order || 0,
    is_active: c.is_active !== false,
    created_at: toIso(c.created_at),
    updated_at: toIso(c.updated_at),
  };
}

export function serializeProductSize(s: any) {
  return {
    id: s.id,
    product_id: s.product_id,
    label: s.label || '',
    chest_cm: Number(s.chest_cm || 0),
    length_cm: Number(s.length_cm || 0),
    sort_order: s.sort_order || 0,
  };
}

/**
 * Jenis produk lengkap (info + varian warna + size chart). Dipakai endpoint
 * admin dan publik agar bentuk JSON-nya identik.
 */
export function serializeProductType(p: any) {
  const colors = Array.isArray(p.colors) ? p.colors.map(serializeProductColor) : [];
  const sizeChart = Array.isArray(p.size_chart) ? p.size_chart.map(serializeProductSize) : [];
  return {
    id: p.id,
    product_key: p.product_key,
    title: p.title || '',
    subtitle: p.subtitle || '',
    description: p.description || '',
    price: Number(p.price || 0),
    supplier: p.supplier || '',
    size_region: p.size_region || '',
    model: p.model || '',
    material: p.material || '',
    thumbnail_url: p.thumbnail_url || '',
    size_guide_url: p.size_guide_url || '',
    is_active: p.is_active !== false,
    sort_order: p.sort_order || 0,
    colors,
    size_chart: sizeChart,
    sizes: sizeChart.map((s: any) => s.label),
    color_count: colors.length,
    created_at: toIso(p.created_at),
    updated_at: toIso(p.updated_at),
  };
}

export function serializeCustomTeeOrder(o: any, withDesign = true) {
  let design: any = null;
  try { design = JSON.parse(o.design_json || 'null'); } catch { design = null; }
  let sizeItems: any[] = [];
  try {
    const parsed = JSON.parse(o.size_items_json || '[]');
    sizeItems = Array.isArray(parsed) ? parsed : [];
  } catch { sizeItems = []; }
  if (sizeItems.length === 0 && o.size) sizeItems = [{ size: o.size, qty: o.qty || 1 }];
  return {
    id: o.id,
    order_code: o.order_code,
    status: o.status,
    customer_name: o.customer_name || '',
    customer_phone: o.customer_phone || '',
    customer_email: o.customer_email || '',
    product_key: o.product_key,
    product_title: o.product_title || '',
    size: o.size || '',
    size_items: sizeItems,
    qty: o.qty || 1,
    color_name: o.color_name || '',
    color_hex: o.color_hex || '',
    objects_count: o.objects_count || 0,
    note: o.note || '',
    submitted_at: toIso(o.submitted_at),
    created_at: toIso(o.created_at),
    updated_at: toIso(o.updated_at),
    ...(withDesign ? { design } : {}),
  };
}

export function serializeCustomProduct(p: any) {
  let sizes: string[] = [];
  let specs: string[] = [];
  try { sizes = JSON.parse(p.sizes_json || '[]'); } catch {}
  try { specs = JSON.parse(p.specs_json || '[]'); } catch {}
  return {
    id: p.id,
    product_key: p.product_key,
    title: p.title || '',
    description: p.description || '',
    size_guide_url: p.size_guide_url || '',
    sizes: Array.isArray(sizes) ? sizes : [],
    specs: Array.isArray(specs) ? specs : [],
    updated_at: toIso(p.updated_at),
  };
}

