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
