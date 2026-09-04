// Idempotent seed - mirrors backend/app/seed.py.
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from './db';
import { env } from './env';
import { hashPassword } from './auth';
import { storage } from './storage';
import { newId } from './http';

const DATA_DIR = path.resolve(process.cwd(), '..', 'backend', 'data');

async function readJsonSafe(file: string): Promise<any[] | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readCsvSafe(file: string): Promise<any[] | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
    const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const parseLine = (l: string) => {
      const cells: string[] = [];
      let cur = ''; let inQ = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
        else cur += ch;
      }
      cells.push(cur);
      return cells;
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1).map((l) => {
      const cells = parseLine(l);
      const o: any = {};
      headers.forEach((h, i) => (o[h.replace(/^"|"$/g, '')] = cells[i] || ''));
      return o;
    });
  } catch {
    return null;
  }
}

function numFromLocale(v: string): number {
  const s = (v || '').trim().toLowerCase();
  if (!s || s === 'variable') return 0;
  const n = parseFloat(s.replace(/\./g, '').replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

export async function seedOwner() {
  const uname = env.OWNER_USERNAME.toLowerCase().trim();
  const existing = await prisma.users.findUnique({ where: { username: uname } });
  if (existing) return existing;
  const anyOwner = await prisma.users.findFirst({ where: { role: 'Owner' }, orderBy: { created_at: 'asc' } });
  if (anyOwner) {
    return await prisma.users.update({
      where: { id: anyOwner.id },
      data: { username: uname, password_hash: await hashPassword(env.OWNER_PASSWORD) },
    });
  }
  const tenantId = newId();
  await prisma.tenants.create({ data: { id: tenantId, name: env.OWNER_BUSINESS, created_at: new Date() } });
  const owner = await prisma.users.create({
    data: {
      id: newId(), tenant_id: tenantId, username: uname,
      password_hash: await hashPassword(env.OWNER_PASSWORD),
      name: env.OWNER_NAME, role: 'Owner', active: true, created_at: new Date(),
    },
  });
  await prisma.settings.create({
    data: {
      tenant_id: tenantId, business_name: env.OWNER_BUSINESS,
      address: 'Jl. Gunung Shangyang 156, Denpasar - Bali',
      phone: '+62 858 8810 2930', currency: 'Rp', tax_rate: 0,
      receipt_footer: 'Terima kasih telah berbelanja!',
      logo: '', print_mode: '', paper_width: '',
    },
  });
  return owner;
}

export async function seedCatalog(tid: string) {
  if (!env.SEED_CATALOG) return;
  const prodCount = await prisma.products.count({ where: { tenant_id: tid } });
  const catCount = await prisma.categories.count({ where: { tenant_id: tid } });
  if (prodCount > 0 || catCount > 0) return;
  const rows = await readCsvSafe('export_items.csv');
  if (!rows || rows.length === 0) return;
  const palette = ['#2563EB', '#7C3AED', '#F97316', '#10B981', '#EF4444', '#0EA5E9'];
  const cats: Record<string, { id: string; name: string }> = {};
  let products = 0;
  for (const row of rows) {
    const handle = String(row.Handle || '').trim();
    const sku = String(row.SKU || '').trim();
    if (!handle && !sku) continue;
    const name = String(row.Name || '').trim();
    if (!cats[handle]) {
      const cname = name || handle.replace(/-/g, ' ').toUpperCase();
      const cid = newId();
      await prisma.categories.create({
        data: {
          id: cid, tenant_id: tid, name: cname,
          color: palette[Object.keys(cats).length % palette.length],
          image: '', sort_order: Object.keys(cats).length, created_at: new Date(),
        },
      });
      cats[handle] = { id: cid, name: cname };
    }
    const cat = cats[handle];
    const variant = String(row['Option 1 value'] || '').trim();
    const pname = variant ? `${cat.name} ${variant}`.trim() : (name || cat.name);
    await prisma.products.create({
      data: {
        id: newId(), tenant_id: tid, name: pname, sku, barcode: String(row.Barcode || '').trim(),
        category_id: cat.id, price: numFromLocale(row['Price [DANESWARA PRINTING]']),
        cost: numFromLocale(row.Cost), stock: 0, min_stock: 5, unit: 'pcs', image: '',
        description: String(row.Description || '').trim(), active: true, sort_order: products, created_at: new Date(),
      },
    });
    products++;
  }
}

export async function seedCustomers(tid: string) {
  if (!env.SEED_CUSTOMERS) return;
  if ((await prisma.customers.count({ where: { tenant_id: tid } })) > 0) return;
  const rows = await readJsonSafe('seed_customers.json');
  if (!rows) return;
  for (const c of rows) {
    if (!c?.name) continue;
    await prisma.customers.create({
      data: {
        id: newId(), tenant_id: tid, name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '',
        visits: Number(c.visits || 0), total_spent: Number(c.total_spent || 0), created_at: new Date(),
      },
    });
  }
}

export async function seedGallery(tid: string) {
  if (!env.SEED_GALLERY) return;
  if ((await prisma.gallery_items.count({ where: { tenant_id: tid } })) > 0) return;
  const rows = await readJsonSafe('gallery_seed.json');
  if (!rows) return;
  for (const it of rows) {
    let src = String(it.src || '').trim();
    if (!src) continue;
    if (src.startsWith('data:image')) {
      try { src = (await storage.uploadDataUri(src, 'gallery')) || ''; } catch { src = ''; }
      if (!src) continue;
    }
    await prisma.gallery_items.create({
      data: {
        id: newId(), tenant_id: tid, src, label: it.label || '', tag: it.tag || '', span: it.span || '',
        sort_order: Number(it.sort_order || 0), created_at: new Date(),
      },
    });
  }
}

export async function runSeed() {
  try {
    const owner = await seedOwner();
    const tid = owner.tenant_id;
    await seedCatalog(tid);
    await seedCustomers(tid);
    await seedGallery(tid);
    console.log('[seed] complete for tenant', tid);
  } catch (e) {
    console.error('[seed] failed', e);
  }
}
