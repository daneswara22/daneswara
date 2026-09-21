// Curated demo seed (~20-30 sample records) for the Emergent dummy MariaDB.
// Run: cd /app/web && npx tsx scripts/seed-demo.ts
// Idempotent-ish: skips inserting a table if it already has rows for the tenant.
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '../lib/db';
import { storage } from '../lib/storage';
import { seedOwner } from '../lib/seed';
import { newId } from '../lib/http';

const DATA_DIR = path.resolve(process.cwd(), '..', 'backend', 'data');
const rnd = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T,>(arr: T[]) => arr[rnd(0, arr.length - 1)];
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000);

async function readJson(file: string): Promise<any[]> {
  try { return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf-8')); } catch { return []; }
}

// ---- Categories & Products (synthetic, realistic printing/DTF business) ----
const CATEGORIES = [
  { name: 'Kaos & Apparel', color: '#2563EB' },
  { name: 'Banner & Spanduk', color: '#F97316' },
  { name: 'Stiker & Label', color: '#10B981' },
  { name: 'Kartu Nama & Undangan', color: '#7C3AED' },
  { name: 'Merchandise', color: '#EF4444' },
  { name: 'Cetak Dokumen', color: '#0EA5E9' },
];

const PRODUCTS: Record<string, [string, number, number, string][]> = {
  'Kaos & Apparel': [
    ['Kaos DTF Cotton Combed 30s', 85000, 42000, 'pcs'],
    ['Kaos Polos Premium', 55000, 28000, 'pcs'],
    ['Hoodie Custom Sablon', 165000, 92000, 'pcs'],
    ['Jersey Printing Full Sublim', 120000, 68000, 'pcs'],
    ['Totebag Kanvas Custom', 45000, 22000, 'pcs'],
  ],
  'Banner & Spanduk': [
    ['Banner Flexi 280gr /m2', 25000, 14000, 'm2'],
    ['X-Banner 60x160 + Stand', 85000, 45000, 'pcs'],
    ['Roll Banner 85x200', 195000, 110000, 'pcs'],
    ['Spanduk Outdoor 340gr /m2', 32000, 18000, 'm2'],
  ],
  'Stiker & Label': [
    ['Stiker Vinyl Glossy A3', 15000, 6000, 'lembar'],
    ['Stiker Transparan A3', 18000, 7500, 'lembar'],
    ['Label Botol Custom', 2500, 900, 'pcs'],
    ['Stiker Cutting Sticker', 35000, 15000, 'm'],
  ],
  'Kartu Nama & Undangan': [
    ['Kartu Nama Art Carton 260gr', 45000, 18000, 'box'],
    ['Undangan Soft Cover', 6500, 3200, 'pcs'],
    ['Undangan Hard Cover', 12000, 6500, 'pcs'],
  ],
  'Merchandise': [
    ['Mug Custom Sublime', 35000, 16000, 'pcs'],
    ['Gantungan Kunci Akrilik', 8000, 3000, 'pcs'],
    ['Pin Peniti 58mm', 4000, 1500, 'pcs'],
    ['Lanyard / Tali ID Card', 12000, 5000, 'pcs'],
  ],
  'Cetak Dokumen': [
    ['Cetak Dokumen A4 Warna', 1500, 500, 'lembar'],
    ['Fotocopy A4 Hitam Putih', 300, 100, 'lembar'],
    ['Jilid Spiral + Mika', 8000, 3500, 'pcs'],
    ['Print Foto 4R Glossy', 3000, 1200, 'lembar'],
  ],
};

async function main() {
  console.log('▶ Ensuring owner/tenant/settings ...');
  const owner = await seedOwner();
  const tid = owner.tenant_id;
  console.log('   tenant:', tid, 'owner:', owner.username);

  // ---- Categories + Products ----
  const catCount = await prisma.categories.count({ where: { tenant_id: tid } });
  const catIdByName: Record<string, string> = {};
  if (catCount === 0) {
    let ci = 0;
    for (const c of CATEGORIES) {
      const id = newId();
      catIdByName[c.name] = id;
      await prisma.categories.create({ data: { id, tenant_id: tid, name: c.name, color: c.color, image: '', sort_order: ci++, created_at: daysAgo(90) } });
    }
    console.log(`   + ${CATEGORIES.length} categories`);
  } else {
    (await prisma.categories.findMany({ where: { tenant_id: tid } })).forEach((c) => (catIdByName[c.name] = c.id));
  }

  const prodList: { id: string; name: string; price: number; cost: number; stock: number }[] = [];
  if ((await prisma.products.count({ where: { tenant_id: tid } })) === 0) {
    let si = 0;
    for (const [catName, items] of Object.entries(PRODUCTS)) {
      const cid = catIdByName[catName];
      for (const [name, price, cost, unit] of items) {
        const id = newId();
        const stock = rnd(8, 120);
        await prisma.products.create({ data: {
          id, tenant_id: tid, name, sku: `SKU-${String(1000 + si)}`, barcode: '', category_id: cid,
          price, cost, stock, min_stock: 5, unit, image: '', description: `${name} — kualitas premium Daneswara Print.`,
          active: true, sort_order: si++, created_at: daysAgo(80),
        } });
        prodList.push({ id, name, price, cost, stock });
      }
    }
    console.log(`   + ${prodList.length} products`);
  } else {
    (await prisma.products.findMany({ where: { tenant_id: tid } })).forEach((p) => prodList.push({ id: p.id, name: p.name, price: p.price, cost: p.cost, stock: p.stock }));
  }

  // ---- Suppliers ----
  if ((await prisma.suppliers.count({ where: { tenant_id: tid } })) === 0) {
    const sups = [
      ['CV Tinta Jaya', '081234500011', 'Denpasar'],
      ['Toko Kaos Grosir Bali', '081234500022', 'Gianyar'],
      ['Vinyl Supplier Nusantara', '081234500033', 'Surabaya'],
      ['Percetakan Bahan Baku', '081234500044', 'Bandung'],
    ];
    for (const [name, phone, addr] of sups) {
      await prisma.suppliers.create({ data: { id: newId(), tenant_id: tid, name, phone, email: '', address: addr, created_at: daysAgo(70) } });
    }
    console.log(`   + ${sups.length} suppliers`);
  }

  // ---- Customers (from real seed file, limited to 24) ----
  let custList: { id: string; name: string; phone: string }[] = [];
  if ((await prisma.customers.count({ where: { tenant_id: tid } })) === 0) {
    const rows = (await readJson('seed_customers.json')).filter((c) => c?.name).slice(0, 24);
    for (const c of rows) {
      const id = newId();
      await prisma.customers.create({ data: {
        id, tenant_id: tid, name: String(c.name).slice(0, 120), phone: c.phone || '', email: c.email || '', address: c.address || '',
        visits: Number(c.visits || 0), total_spent: Number(c.total_spent || 0), created_at: daysAgo(rnd(10, 120)),
      } });
      custList.push({ id, name: String(c.name), phone: c.phone || '' });
    }
    console.log(`   + ${custList.length} customers`);
  } else {
    (await prisma.customers.findMany({ where: { tenant_id: tid }, take: 24 })).forEach((c) => custList.push({ id: c.id, name: c.name, phone: c.phone || '' }));
  }

  // ---- Gallery (from real base64 seed, limited to 12, uploaded to disk as WebP) ----
  if ((await prisma.gallery_items.count({ where: { tenant_id: tid } })) === 0) {
    const rows = (await readJson('gallery_seed.json')).slice(0, 12);
    let gi = 0, ok = 0;
    for (const it of rows) {
      let src = String(it.src || '').trim();
      if (!src) continue;
      if (src.startsWith('data:image')) {
        try { src = (await storage.uploadDataUri(src, 'gallery')) || ''; } catch { src = ''; }
      }
      if (!src) continue;
      await prisma.gallery_items.create({ data: {
        id: newId(), tenant_id: tid, src, label: it.label || `Karya Daneswara ${gi + 1}`,
        tag: it.tag || pick(['DTF', 'Sablon', 'Banner', 'Merchandise']), span: it.span || '',
        sort_order: rows.length - gi, created_at: daysAgo(rnd(5, 60)),
      } });
      gi++; ok++;
    }
    console.log(`   + ${ok} gallery items (uploaded to disk WebP)`);
  }

  // ---- Sales (~14) with stock movements, so dashboard/reports populate ----
  if ((await prisma.sales.count({ where: { tenant_id: tid } })) === 0 && prodList.length) {
    const methods = ['cash', 'qris', 'transfer', 'debit'];
    let n = 0;
    for (let i = 0; i < 14; i++) {
      const when = daysAgo(rnd(0, 27));
      const nLines = rnd(1, 3);
      const items: any[] = [];
      let subtotal = 0, cost = 0;
      for (let l = 0; l < nLines; l++) {
        const p = pick(prodList);
        const qty = rnd(1, 5);
        items.push({ id: p.id, name: p.name, price: p.price, qty, cost: p.cost });
        subtotal += p.price * qty;
        cost += p.cost * qty;
      }
      const discount = Math.random() < 0.3 ? rnd(1, 10) * 1000 : 0;
      const total = Math.max(0, subtotal - discount);
      const profit = total - cost;
      const cust = Math.random() < 0.7 && custList.length ? pick(custList) : null;
      const yy = when.toISOString().slice(2, 10).replace(/-/g, '');
      const invoice = `INV-${yy}-${String(1000 + i)}`;
      const method = pick(methods);
      const paid = method === 'cash' ? Math.ceil(total / 5000) * 5000 : total;
      await prisma.sales.create({ data: {
        id: newId(), tenant_id: tid, invoice, items: JSON.stringify(items), subtotal, discount,
        tax_rate: 0, tax: 0, total, cost, profit, payment_method: method, paid_amount: paid, change: paid - total,
        customer_name: cust?.name || null, customer_id: cust?.id || null, customer_phone: cust?.phone || null,
        channel: pick(['pos', 'whatsapp', 'walk-in']), from_order: null, cashier: 'Owner', cashier_id: owner.id,
        refunded: false, created_at: when,
      } });
      // stock movement for first line
      const first = items[0];
      const before = rnd(20, 100);
      await prisma.stock_movements.create({ data: {
        id: newId(), tenant_id: tid, product_id: first.id, product_name: first.name, type: 'out',
        qty: first.qty, before, after: before - first.qty, note: `Penjualan ${invoice}`, user_name: 'Owner', created_at: when,
      } });
      n++;
    }
    console.log(`   + ${n} sales (+ stock movements)`);
  }

  // ---- Custom Orders (~5, various statuses) ----
  if ((await prisma.orders.count({ where: { tenant_id: tid } })) === 0 && prodList.length) {
    const statuses = ['Draft', 'Proses', 'Proses', 'Selesai', 'Selesai'];
    for (let i = 0; i < statuses.length; i++) {
      const when = daysAgo(rnd(1, 20));
      const p = pick(prodList);
      const qty = rnd(10, 50);
      const subtotal = p.price * qty;
      const total = subtotal;
      const deposit = Math.round(total * 0.5);
      const status = statuses[i];
      const cust = custList.length ? pick(custList) : null;
      const yy = when.toISOString().slice(2, 10).replace(/-/g, '');
      await prisma.orders.create({ data: {
        id: newId(), tenant_id: tid, order_number: `ORD-${yy}-${String(100 + i)}`,
        customer_id: cust?.id || null, customer_name: cust?.name || 'Pelanggan',
        items: JSON.stringify([{ id: p.id, name: p.name, price: p.price, qty }]),
        subtotal, discount: 0, tax_rate: 0, tax: 0, total, deposit_amount: status === 'Draft' ? 0 : deposit,
        deposit_method: status === 'Draft' ? null : 'transfer', remaining: status === 'Selesai' ? 0 : total - (status === 'Draft' ? 0 : deposit),
        note: 'Pesanan custom sablon.', order_type: 'custom', channel: 'whatsapp', status,
        cashier: 'Owner', invoice: null, payment_method: null, settle_paid: status === 'Selesai' ? total : null,
        completed_at: status === 'Selesai' ? when : null, created_at: when,
      } });
    }
    console.log('   + 5 custom orders');
  }

  // ---- Expenses (~6) ----
  if ((await prisma.expenses.count({ where: { tenant_id: tid } })) === 0) {
    const exp = [
      ['Bahan Baku', 1500000, 'Beli tinta & bahan kaos'],
      ['Operasional', 450000, 'Listrik & internet'],
      ['Gaji', 3500000, 'Gaji karyawan'],
      ['Sewa', 2000000, 'Sewa ruko bulanan'],
      ['Transport', 200000, 'Pengiriman order'],
      ['Marketing', 350000, 'Iklan sosial media'],
    ];
    for (const [cat, amt, note] of exp) {
      const when = daysAgo(rnd(1, 25));
      await prisma.expenses.create({ data: {
        id: newId(), tenant_id: tid, category: cat as string, amount: amt as number, note: note as string,
        date: new Date(when.toISOString().slice(0, 10)), user_name: 'Owner', source: 'manual', created_at: when,
      } });
    }
    console.log('   + 6 expenses');
  }

  // ---- Summary ----
  const counts = {
    categories: await prisma.categories.count({ where: { tenant_id: tid } }),
    products: await prisma.products.count({ where: { tenant_id: tid } }),
    customers: await prisma.customers.count({ where: { tenant_id: tid } }),
    suppliers: await prisma.suppliers.count({ where: { tenant_id: tid } }),
    gallery: await prisma.gallery_items.count({ where: { tenant_id: tid } }),
    sales: await prisma.sales.count({ where: { tenant_id: tid } }),
    orders: await prisma.orders.count({ where: { tenant_id: tid } }),
    expenses: await prisma.expenses.count({ where: { tenant_id: tid } }),
  };
  console.log('\n─── Seed summary ───');
  console.log(counts);
  console.log('Total records:', Object.values(counts).reduce((a, b) => a + b, 0));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('SEED FAILED', e); await prisma.$disconnect(); process.exit(1); });
