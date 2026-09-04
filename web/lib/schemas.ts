// Zod schemas mirroring backend/app/schemas.py
import { z } from 'zod';

export const PAYMENT_METHODS = ['Tunai', 'BCA TOKO', 'BRI TOKO', 'BCA ADMIN (ELIS)', 'QRIS', 'E-Wallet'] as const;
export const ROLES = ['Owner', 'Manager', 'Kasir', 'Gudang'] as const;

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
  color: z.string().optional().default('#2563EB'),
  image: z.string().optional().default(''),
});

export const productInputSchema = z.object({
  name: z.string(),
  sku: z.string().optional().default(''),
  barcode: z.string().optional().default(''),
  category_id: z.string().nullable().optional(),
  price: z.number().default(0),
  cost: z.number().default(0),
  stock: z.number().int().default(0),
  min_stock: z.number().int().default(5),
  unit: z.string().optional().default('pcs'),
  image: z.string().optional().default(''),
  description: z.string().optional().default(''),
  active: z.boolean().default(true),
});

export const reorderInputSchema = z.object({ ids: z.array(z.string()) });

export const saleItemSchema = z.object({
  product_id: z.string(),
  name: z.string(),
  price: z.number(),
  qty: z.number().int(),
  cost: z.number().default(0),
  note: z.string().optional().default(''),
});

export const saleInputSchema = z.object({
  items: z.array(saleItemSchema),
  discount: z.number().default(0),
  tax_rate: z.number().default(0),
  payment_method: z.enum(PAYMENT_METHODS),
  paid_amount: z.number().default(0),
  customer_name: z.string().optional().default(''),
  customer_id: z.string().nullable().optional(),
  order_id: z.string().nullable().optional(),
  channel: z.string().optional().default('Toko'),
});

export const stockInputSchema = z.object({
  product_id: z.string(),
  type: z.enum(['Masuk', 'Keluar', 'Penyesuaian', 'Opname']),
  qty: z.number().int(),
  note: z.string().optional().default(''),
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
  phone: z.string().optional().default(''),
  email: z.string().optional().default(''),
  address: z.string().optional().default(''),
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
  supplier_name: z.string().optional().default(''),
  items: z.array(poItemSchema),
  note: z.string().optional().default(''),
});

export const supplierRefSchema = z.object({ supplier_id: z.string().nullable().optional() });

export const heldOrderInputSchema = z.object({
  label: z.string(),
  items: z.array(saleItemSchema),
  discount: z.number().default(0),
});

export const customOrderInputSchema = z.object({
  customer_id: z.string().nullable().optional(),
  customer_name: z.string().optional().default(''),
  items: z.array(saleItemSchema),
  discount: z.number().default(0),
  tax_rate: z.number().default(0),
  deposit_amount: z.number().default(0),
  deposit_method: z.enum(PAYMENT_METHODS).default('Tunai'),
  order_type: z.string().default('Reguler'),
  note: z.string().optional().default(''),
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
  customer_name: z.string().optional().default(''),
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
  note: z.string().optional().default(''),
  date: z.string().nullable().optional(),
});

export const galleryInputSchema = z.object({
  src: z.string(),
  label: z.string(),
  tag: z.string().optional().default(''),
  span: z.string().optional().default(''),
  sort_order: z.number().int().nullable().optional().default(0),
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
