/**
 * Sandbox-only dummy seed (NOT for production).
 * Creates a small, realistic dataset (5-10 rows per core table) on an EMPTY local
 * MariaDB so the Emergent preview can be explored end-to-end.
 * Idempotent: skips any table that already has rows for the tenant.
 *
 * Run: cd /app/web && npx tsx scripts/seed-dummy-sandbox.ts
 */
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/db';
import { seedOwner } from '../lib/seed';
import { hashPassword } from '../lib/auth';
import { storage } from '../lib/storage';
import { env } from '../lib/env';
import { ensureSeedProductTypes } from '../lib/productTypeQueries';

const nid = () => crypto.randomUUID();
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
const dOnly = (d: number) => {
  const x = daysAgo(d);
  return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
};

async function main() {
  const owner = await seedOwner();
  const tid = owner.tenant_id;
  console.log('tenant:', tid, '| owner:', owner.username);

  // ---- Staff users (Manager, Kasir, Gudang) ----
  const staffPassword = process.env.SEED_STAFF_PASSWORD || env.OWNER_PASSWORD;
  if ((await prisma.users.count({ where: { tenant_id: tid } })) < 2) {
    const staff = [
      { username: 'manager', name: 'Rina Manager', role: 'Manager' },
      { username: 'kasir', name: 'Budi Kasir', role: 'Kasir' },
      { username: 'gudang', name: 'Wayan Gudang', role: 'Gudang' },
    ];
    for (const s of staff) {
      await prisma.users.create({
        data: {
          id: nid(), tenant_id: tid, username: s.username,
          password_hash: await hashPassword(staffPassword),
          name: s.name, role: s.role, active: true, created_at: daysAgo(30),
        },
      });
    }
    console.log('users: +3 staff');
  }

  // ---- Categories (6) ----
  let cats = await prisma.categories.findMany({ where: { tenant_id: tid } });
  if (cats.length === 0) {
    const defs = [
      { name: 'DTF Printing', color: '#2563EB' },
      { name: 'Sablon Kaos', color: '#7C3AED' },
      { name: 'Custom Tees', color: '#F97316' },
      { name: 'Label & Woven', color: '#10B981' },
      { name: 'Bordir & Patch', color: '#EF4444' },
      { name: 'Merchandise', color: '#0EA5E9' },
    ];
    for (let i = 0; i < defs.length; i++) {
      await prisma.categories.create({
        data: { id: nid(), tenant_id: tid, name: defs[i].name, color: defs[i].color, image: '', sort_order: i, created_at: daysAgo(28) },
      });
    }
    cats = await prisma.categories.findMany({ where: { tenant_id: tid }, orderBy: { sort_order: 'asc' } });
    console.log('categories: +' + cats.length);
  }
  const catId = (n: string) => cats.find((c) => c.name === n)?.id || cats[0]?.id;

  // ---- Products (10) ----
  let prods = await prisma.products.findMany({ where: { tenant_id: tid } });
  if (prods.length === 0) {
    const defs = [
      { name: 'DTF Print A3', sku: 'DTF-A3', cat: 'DTF Printing', price: 35000, cost: 18000, stock: 120 },
      { name: 'DTF Print A4', sku: 'DTF-A4', cat: 'DTF Printing', price: 22000, cost: 11000, stock: 200 },
      { name: 'DTF Print A5', sku: 'DTF-A5', cat: 'DTF Printing', price: 13000, cost: 6500, stock: 250 },
      { name: 'Kaos Cotton Combed 30s Putih', sku: 'KAOS-30S-WH', cat: 'Sablon Kaos', price: 65000, cost: 38000, stock: 64 },
      { name: 'Kaos Cotton Combed 30s Hitam', sku: 'KAOS-30S-BK', cat: 'Sablon Kaos', price: 65000, cost: 38000, stock: 48 },
      { name: 'Premium Cotton T-shirt 7200', sku: 'NSA-7200', cat: 'Custom Tees', price: 125000, cost: 72000, stock: 30 },
      { name: 'Woven Label Satin (100 pcs)', sku: 'LBL-WOV-100', cat: 'Label & Woven', price: 150000, cost: 88000, stock: 25 },
      { name: 'Size Label Bikini (100 pcs)', sku: 'LBL-SIZE-100', cat: 'Label & Woven', price: 95000, cost: 52000, stock: 18 },
      { name: 'Patch Bordir Custom 7cm', sku: 'PATCH-7', cat: 'Bordir & Patch', price: 18000, cost: 9000, stock: 140 },
      { name: 'Totebag Canvas Sablon', sku: 'TOTE-CNV', cat: 'Merchandise', price: 55000, cost: 29000, stock: 4 },
    ];
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      await prisma.products.create({
        data: {
          id: nid(), tenant_id: tid, name: d.name, sku: d.sku, barcode: '',
          category_id: catId(d.cat), price: d.price, cost: d.cost, stock: d.stock,
          min_stock: 10, unit: 'pcs', image: '', description: `${d.name} - produk sample sandbox.`,
          active: true, sort_order: i, created_at: daysAgo(26),
        },
      });
    }
    prods = await prisma.products.findMany({ where: { tenant_id: tid }, orderBy: { sort_order: 'asc' } });
    console.log('products: +' + prods.length);
  }

  // ---- Customers (8) ----
  let custs = await prisma.customers.findMany({ where: { tenant_id: tid } });
  if (custs.length === 0) {
    const defs = [
      ['Gili Surf Shop', '081234567801', 'gili@example.com', 'Gili Trawangan, Lombok'],
      ['Bali Bikini Co', '081234567802', 'hello@balibikini.example', 'Seminyak, Badung'],
      ['Warung Kopi Shangyang', '081234567803', '', 'Jl. Gunung Shangyang, Denpasar'],
      ['SMA Negeri 3 Denpasar', '081234567804', 'osis@sman3.example', 'Denpasar Timur'],
      ['Canggu Fitness Club', '081234567805', 'info@cangguf.example', 'Canggu, Badung'],
      ['Toko Merch Ubud', '081234567806', '', 'Ubud, Gianyar'],
      ['Komang Printing Partner', '081234567807', '', 'Tabanan'],
      ['Walk-in Customer', '', '', ''],
    ];
    for (const [name, phone, email, address] of defs) {
      await prisma.customers.create({
        data: { id: nid(), tenant_id: tid, name, phone, email, address, visits: Math.floor(Math.random() * 6) + 1, total_spent: 0, created_at: daysAgo(24) },
      });
    }
    custs = await prisma.customers.findMany({ where: { tenant_id: tid } });
    console.log('customers: +' + custs.length);
  }

  // ---- Suppliers (5) ----
  if ((await prisma.suppliers.count({ where: { tenant_id: tid } })) === 0) {
    const defs = [
      ['CV Tinta Nusantara', '0361111222', 'sales@tintanusantara.example', 'Denpasar'],
      ['PT Kain Combed Jaya', '0361333444', 'order@combedjaya.example', 'Bandung'],
      ['Sablon Supply Bali', '0361555666', '', 'Badung'],
      ['Label Woven Indo', '0213334444', '', 'Jakarta'],
      ['Aksesoris Merch ID', '0318889999', '', 'Surabaya'],
    ];
    for (const [name, phone, email, address] of defs) {
      await prisma.suppliers.create({ data: { id: nid(), tenant_id: tid, name, phone, email, address, created_at: daysAgo(22) } });
    }
    console.log('suppliers: +5');
  }
  const suppliers = await prisma.suppliers.findMany({ where: { tenant_id: tid } });

  // ---- Gallery (8 items, base64 -> WebP -> R2) ----
  if ((await prisma.gallery_items.count({ where: { tenant_id: tid } })) === 0) {
    const raw = JSON.parse(await fs.readFile(path.resolve(process.cwd(), '..', 'backend', 'data', 'gallery_seed.json'), 'utf-8'));
    const picked = raw.slice(0, 8);
    let n = 0;
    for (const it of picked) {
      let src = String(it.src || '').trim();
      if (!src) continue;
      if (src.startsWith('data:image')) {
        try { src = (await storage.uploadDataUri(src, 'gallery')) || ''; } catch (e: any) { console.warn('  r2 upload failed:', e?.message); src = ''; }
        if (!src) continue;
      }
      await prisma.gallery_items.create({
        data: { id: nid(), tenant_id: tid, src, label: it.label || 'Sample', tag: it.tag || '', span: it.span || '', sort_order: Number(it.sort_order || n), created_at: daysAgo(20) },
      });
      n++;
    }
    console.log('gallery_items: +' + n);
  }

  // ---- Finance categories ----
  if ((await prisma.finance_categories.count({ where: { tenant_id: tid } })) === 0) {
    const defs: [string, string][] = [
      ['expense', 'Bahan Baku'], ['expense', 'Operasional'], ['expense', 'Gaji'], ['expense', 'Listrik & Internet'],
      ['income', 'Jasa Desain'], ['income', 'Sewa Alat'],
    ];
    for (const [type, name] of defs) {
      await prisma.finance_categories.create({ data: { id: nid(), tenant_id: tid, type, name, created_at: daysAgo(18) } });
    }
    console.log('finance_categories: +6');
  }

  // ---- Sales (6 invoices) + stock movements ----
  if ((await prisma.sales.count({ where: { tenant_id: tid } })) === 0) {
    const mk = (i: number) => {
      const p1 = prods[i % prods.length];
      const p2 = prods[(i + 3) % prods.length];
      const items = [
        { product_id: p1.id, name: p1.name, price: p1.price, cost: p1.cost, qty: (i % 3) + 1, unit: 'pcs' },
        { product_id: p2.id, name: p2.name, price: p2.price, cost: p2.cost, qty: 1, unit: 'pcs' },
      ];
      const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
      const cost = items.reduce((s, it) => s + it.cost * it.qty, 0);
      const discount = i === 2 ? 10000 : 0;
      const total = subtotal - discount;
      const d = daysAgo(i);
      const yy = String(d.getFullYear()).slice(2), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
      return { items, subtotal, cost, discount, total, d, invoice: `INV-${yy}${mm}${dd}-${String(1001 + i).slice(-4)}` };
    };
    for (let i = 0; i < 6; i++) {
      const s = mk(i);
      const cust = custs[i % custs.length];
      await prisma.sales.create({
        data: {
          id: nid(), tenant_id: tid, invoice: s.invoice, items: JSON.stringify(s.items),
          subtotal: s.subtotal, discount: s.discount, tax_rate: 0, tax: 0, total: s.total,
          cost: s.cost, profit: s.total - s.cost,
          payment_method: i % 2 === 0 ? 'cash' : 'qris',
          paid_amount: s.total, change: 0,
          customer_name: cust.name, customer_id: cust.id, customer_phone: cust.phone || '',
          channel: 'offline', from_order: null, cashier: 'Budi Kasir', cashier_id: null,
          refunded: false, refunded_at: null, created_at: s.d,
        },
      });
      for (const it of s.items) {
        const p = prods.find((x) => x.id === it.product_id)!;
        await prisma.stock_movements.create({
          data: {
            id: nid(), tenant_id: tid, product_id: p.id, product_name: p.name, type: 'out',
            qty: it.qty, before: p.stock + it.qty, after: p.stock, note: `Penjualan ${s.invoice}`,
            user_name: 'Budi Kasir', created_at: s.d,
          },
        });
      }
    }
    console.log('sales: +6 (+ stock movements)');
  }

  // ---- Orders (5: mixed status) ----
  if ((await prisma.orders.count({ where: { tenant_id: tid } })) === 0) {
    const statuses = ['pending', 'pending', 'in_progress', 'ready', 'completed'];
    for (let i = 0; i < 5; i++) {
      const p = prods[(i + 2) % prods.length];
      const qty = (i % 4) + 2;
      const items = [{ product_id: p.id, name: p.name, price: p.price, cost: p.cost, qty, unit: 'pcs' }];
      const subtotal = p.price * qty;
      const deposit = Math.round(subtotal * 0.5);
      const cust = custs[(i + 1) % custs.length];
      const d = daysAgo(i + 1);
      const yy = String(d.getFullYear()).slice(2), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
      await prisma.orders.create({
        data: {
          id: nid(), tenant_id: tid, order_number: `ORD-${yy}${mm}${dd}-${String(101 + i)}`,
          customer_id: cust.id, customer_name: cust.name, items: JSON.stringify(items),
          subtotal, discount: 0, tax_rate: 0, tax: 0, total: subtotal,
          deposit_amount: deposit, deposit_method: 'cash', remaining: subtotal - deposit,
          note: 'Pesanan sample sandbox', order_type: 'custom', channel: i % 2 ? 'whatsapp' : 'offline',
          status: statuses[i], cashier: 'Budi Kasir', invoice: null, payment_method: null,
          settle_paid: null, completed_at: statuses[i] === 'completed' ? d : null, created_at: d,
        },
      });
    }
    console.log('orders: +5');
  }

  // ---- Purchases (4) ----
  if ((await prisma.purchases.count({ where: { tenant_id: tid } })) === 0) {
    for (let i = 0; i < 4; i++) {
      const p = prods[i % prods.length];
      const qty = 20 + i * 5;
      const sup = suppliers[i % suppliers.length];
      const d = daysAgo(i + 3);
      const yy = String(d.getFullYear()).slice(2), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
      await prisma.purchases.create({
        data: {
          id: nid(), tenant_id: tid, po_number: `PO-${yy}${mm}${dd}-${String(201 + i)}`,
          supplier_id: sup?.id || null, supplier_name: sup?.name || null,
          items: JSON.stringify([{ product_id: p.id, name: p.name, qty, cost: p.cost }]),
          total: p.cost * qty, note: 'Restock sample', customer_name: null, order_id: null, order_number: null,
          status: i < 2 ? 'received' : 'pending', cashier: 'Wayan Gudang',
          received_at: i < 2 ? d : null, created_at: d,
        },
      });
    }
    console.log('purchases: +4');
  }

  // ---- Expenses (5) & other income (4) ----
  if ((await prisma.expenses.count({ where: { tenant_id: tid } })) === 0) {
    const defs: [string, number, string][] = [
      ['Bahan Baku', 1250000, 'Beli tinta DTF 1L'],
      ['Operasional', 350000, 'Kirim paket ke Lombok'],
      ['Listrik & Internet', 780000, 'Tagihan bulan ini'],
      ['Gaji', 4500000, 'Gaji staff produksi'],
      ['Operasional', 125000, 'Konsumsi tim'],
    ];
    for (let i = 0; i < defs.length; i++) {
      const [category, amount, note] = defs[i];
      await prisma.expenses.create({
        data: { id: nid(), tenant_id: tid, category, amount, note, date: dOnly(i + 1), user_name: 'Owner', source: 'manual', created_at: daysAgo(i + 1) },
      });
    }
    console.log('expenses: +5');
  }
  if ((await prisma.other_income.count({ where: { tenant_id: tid } })) === 0) {
    const defs: [string, number, string][] = [
      ['Jasa Desain', 450000, 'Desain logo klien Gili'],
      ['Sewa Alat', 300000, 'Sewa heat press 2 hari'],
      ['Jasa Desain', 250000, 'Revisi artwork bikini label'],
      ['Sewa Alat', 200000, 'Sewa mesin cutting'],
    ];
    for (let i = 0; i < defs.length; i++) {
      const [category, amount, note] = defs[i];
      await prisma.other_income.create({
        data: { id: nid(), tenant_id: tid, category, amount, note, date: dOnly(i + 2), user_name: 'Owner', source: 'manual', created_at: daysAgo(i + 2) },
      });
    }
    console.log('other_income: +4');
  }

  // ---- Custom tee orders (3) ----
  if ((await prisma.custom_tee_orders.count({ where: { tenant_id: tid } })) === 0) {
    const defs = [
      { name: 'Gili Surf Shop', phone: '081234567801', status: 'submitted', color: ['Putih', '#FFFFFF'], sizes: { M: 10, L: 12, XL: 8 } },
      { name: 'Canggu Fitness Club', phone: '081234567805', status: 'quoted', color: ['Hitam', '#111111'], sizes: { L: 20, XL: 10 } },
      { name: 'Toko Merch Ubud', phone: '081234567806', status: 'draft', color: ['Navy', '#1E3A8A'], sizes: { S: 5, M: 5 } },
    ];
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const items = Object.entries(d.sizes).map(([size, qty]) => ({ size, qty }));
      const qty = items.reduce((s, it) => s + (it.qty as number), 0);
      await prisma.custom_tee_orders.create({
        data: {
          id: nid(), tenant_id: tid, order_code: `CT-${String(1001 + i)}`, status: d.status,
          customer_name: d.name, customer_phone: d.phone, customer_email: '',
          product_key: 'premium-cotton-7200', product_title: 'New States Apparel Premium Cotton T-shirt 7200',
          size: items.map((it) => `${it.size} x${it.qty}`).join(', '), size_items_json: JSON.stringify(items),
          qty, color_name: d.color[0], color_hex: d.color[1], objects_count: 2,
          design_json: JSON.stringify({ views: { front: { objects: [{ type: 'text', text: d.name }] } } }),
          note: 'Sample order sandbox', submitted_at: d.status === 'draft' ? null : daysAgo(i + 1),
          created_at: daysAgo(i + 1), updated_at: daysAgo(i),
        },
      });
    }
    console.log('custom_tee_orders: +3');
  }

  // ---- Activities (6) ----
  if ((await prisma.activities.count({ where: { tenant_id: tid } })) === 0) {
    const defs = ['login', 'create_sale', 'create_order', 'receive_purchase', 'update_product', 'add_expense'];
    for (let i = 0; i < defs.length; i++) {
      await prisma.activities.create({
        data: { id: nid(), tenant_id: tid, user_id: owner.id, user_name: 'Owner', action: defs[i], detail: 'Sample activity sandbox', created_at: daysAgo(i) },
      });
    }
    console.log('activities: +6');
  }

  // ---- Jenis Produk (custom tee): info + warna + size chart ----
  {
    const changed = await ensureSeedProductTypes(tid);
    const p = await prisma.custom_products.count({ where: { tenant_id: tid } });
    const c = await prisma.custom_product_colors.count({ where: { tenant_id: tid } });
    const s = await prisma.custom_product_sizes.count({ where: { tenant_id: tid } });
    console.log(`custom_products: ${p} (warna ${c}, size chart ${s})${changed ? '' : ' [sudah ada]'}`);
  }

  const counts = {
    users: await prisma.users.count(), categories: await prisma.categories.count(),
    products: await prisma.products.count(), customers: await prisma.customers.count(),
    suppliers: await prisma.suppliers.count(), gallery: await prisma.gallery_items.count(),
    sales: await prisma.sales.count(), orders: await prisma.orders.count(),
    purchases: await prisma.purchases.count(), expenses: await prisma.expenses.count(),
    other_income: await prisma.other_income.count(), custom_tee_orders: await prisma.custom_tee_orders.count(),
    custom_products: await prisma.custom_products.count(),
    custom_product_colors: await prisma.custom_product_colors.count(),
    custom_product_sizes: await prisma.custom_product_sizes.count(),
  };
  console.log('\nFinal counts:', counts);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
