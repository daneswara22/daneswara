// Zod schemas mirroring backend/app/schemas.py
import { z } from 'zod';

export const PAYMENT_METHODS = ['Tunai', 'BCA TOKO', 'BRI TOKO', 'BCA ADMIN (ELIS)', 'QRIS', 'E-Wallet'] as const;
export const ROLES = ['Owner', 'Manager', 'Kasir', 'Gudang'] as const;

// Beberapa form mengirim nilai null untuk kolom kosong (hasil dari data DB
// yang bernilai NULL). Helper ini menerima null/undefined lalu mengubahnya ke
// nilai bawaan supaya tidak memicu "Expected string, received null".
const optStr = (def = '') => z.string().nullish().transform((v) => v ?? def);
const optNum = (def = 0) => z.number().nullish().transform((v) => (v == null ? def : v));

export const loginSchema = z.object({ username: z.string(), password: z.string() });
export const changePasswordSchema = z.object({ current_password: z.string(), new_password: z.string() });

export const userCreateSchema = z.object({
  username: z.string(),
  password: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
});
export const userUpdateSchema = z.object({
  name: z.string().optional(),
  role: z.enum(ROLES).optional(),
  password: z.string().optional(),
  active: z.boolean().optional(),
});

export const categoryInputSchema = z.object({
  name: z.string(),
  color: optStr('#2563EB').optional().default('#2563EB'),
  image: optStr().optional().default(''),
});

export const productInputSchema = z.object({
  name: z.string(),
  sku: optStr().optional().default(''),
  barcode: optStr().optional().default(''),
  category_id: z.string().nullable().optional(),
  price: optNum(0).optional().default(0),
  cost: optNum(0).optional().default(0),
  stock: optNum(0).optional().default(0),
  min_stock: optNum(5).optional().default(5),
  unit: optStr('pcs').optional().default('pcs'),
  image: optStr().optional().default(''),
  description: optStr().optional().default(''),
  active: z.boolean().nullish().transform((v) => v ?? true).optional().default(true),
});

export const reorderInputSchema = z.object({ ids: z.array(z.string()) });

export const saleItemSchema = z.object({
  product_id: z.string(),
  name: z.string(),
  price: z.number(),
  qty: z.number().int(),
  cost: z.number().default(0),
  disc: z.number().default(0),
  note: optStr().optional().default(''),
});

export const saleInputSchema = z.object({
  items: z.array(saleItemSchema),
  discount: z.number().default(0),
  tax_rate: z.number().default(0),
  payment_method: z.enum(PAYMENT_METHODS),
  paid_amount: z.number().default(0),
  customer_name: optStr().optional().default(''),
  customer_id: z.string().nullable().optional(),
  order_id: z.string().nullable().optional(),
  channel: z.string().optional().default('Toko'),
});

export const stockInputSchema = z.object({
  product_id: z.string(),
  type: z.enum(['Masuk', 'Keluar', 'Penyesuaian', 'Opname']),
  qty: z.number().int(),
  note: optStr().optional().default(''),
});

export const settingsInputSchema = z.object({
  business_name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  tax_rate: z.number().nullable().optional(),
  receipt_footer: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  print_mode: z.string().nullable().optional(),
  paper_width: z.string().nullable().optional(),
  printers: z.any().nullable().optional(),
  active_printer: z.string().nullable().optional(),
}).passthrough();

export const customerInputSchema = z.object({
  name: z.string(),
  phone: optStr().optional().default(''),
  email: optStr().optional().default(''),
  address: optStr().optional().default(''),
});

export const supplierInputSchema = customerInputSchema;

export const poItemSchema = z.object({
  product_id: z.string(),
  name: z.string(),
  qty: z.number().int(),
  cost: z.number().default(0),
});

export const purchaseOrderInputSchema = z.object({
  supplier_id: z.string().nullable().optional(),
  supplier_name: optStr().optional().default(''),
  items: z.array(poItemSchema),
  note: optStr().optional().default(''),
});

export const supplierRefSchema = z.object({ supplier_id: z.string().nullable().optional() });

export const heldOrderInputSchema = z.object({
  label: z.string(),
  items: z.array(saleItemSchema),
  discount: z.number().default(0),
});

export const customOrderInputSchema = z.object({
  customer_id: z.string().nullable().optional(),
  customer_name: optStr().optional().default(''),
  items: z.array(saleItemSchema),
  discount: z.number().default(0),
  tax_rate: z.number().default(0),
  deposit_amount: z.number().default(0),
  deposit_method: z.enum(PAYMENT_METHODS).default('Tunai'),
  order_type: z.string().default('Reguler'),
  note: optStr().optional().default(''),
  channel: z.string().optional().default('Toko'),
});

export const orderDepositSchema = z.object({
  deposit_amount: z.number(),
  deposit_method: z.enum(PAYMENT_METHODS).default('Tunai'),
});

export const updateOrderSchema = z.object({
  items: z.array(saleItemSchema),
  discount: z.number().default(0),
  tax_rate: z.number().default(0),
  customer_name: optStr().optional().default(''),
  order_type: z.string().default('Reguler'),
});

export const settleOrderSchema = z.object({
  payment_method: z.enum(PAYMENT_METHODS),
  paid_amount: z.number().default(0),
});

export const financeCategoryInputSchema = z.object({
  name: z.string(),
  type: z.enum(['expense', 'income']),
});

export const financeEntryInputSchema = z.object({
  category: z.string(),
  amount: z.number(),
  note: optStr().optional().default(''),
  date: z.string().nullable().optional(),
  source: z.string().optional().default('Tunai'),
});

export const galleryInputSchema = z.object({
  src: z.string(),
  label: z.string(),
  tag: optStr().optional().default(''),
  span: optStr().optional().default(''),
  sort_order: z.number().int().nullable().optional().default(0),
});

/* ---------- Custom Tees order flow ---------- */
const customTeeBase = {
  product_key: z.string().optional().default('premium-cotton-7200'),
  product_title: z.string().optional().default('Custom Tees'),
  size: z.string().optional().default('L'),
  size_items: z.array(z.object({
    size: z.string().min(1),
    qty: z.coerce.number().int().min(1).max(9999),
  })).optional().default([]),
  qty: z.coerce.number().int().min(1).max(99999).optional().default(1),
  color_name: z.string().optional().default('Putih'),
  color_hex: z.string().optional().default('#ffffff'),
  note: optStr().optional().default(''),
};

export const customTeeDraftSchema = z.object({
  ...customTeeBase,
  design: z.record(z.string(), z.array(z.any())).optional().default({}),
});

/** Estimasi harga: tidak menulis data, jadi cukup ukuran + jumlah objek per sisi. */
export const customTeeQuoteSchema = z.object({
  size: z.string().optional().default('L'),
  size_items: z.array(z.object({
    size: z.string().min(1),
    qty: z.coerce.number().int().min(1).max(9999),
  })).optional().default([]),
  qty: z.coerce.number().int().min(1).max(99999).optional().default(1),
  design: z.record(z.string(), z.array(z.any())).optional().default({}),
});

export const customTeeOrderSchema = z.object({
  ...customTeeBase,
  draft_id: z.string().nullable().optional(),
  customer_name: optStr().optional().default(''),
  customer_phone: optStr().optional().default(''),
  customer_email: z.string().nullable().optional().default(''),
  design: z.record(z.string(), z.array(z.any())).nullable().optional(),
});

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body);
  if (!r.success) {
    const first = r.error.issues[0];
    const path = first.path.join('.');
    throw new Error(`${path}: ${first.message}`);
  }
  return r.data;
}
