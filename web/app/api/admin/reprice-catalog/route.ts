import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { promises as fs } from 'fs';
import path from 'path';

function parseNum(v: string): number {
  const s = (v || '').trim().toLowerCase();
  if (!s || s === 'variable') return 0;
  const cleaned = s.replace(/\./g, '').replace(/,/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseCsv(content: string): any[] {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, ''));
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parser (no embedded quoted commas). If needed, use papaparse later.
    const cells: string[] = [];
    let cur = ''; let inQ = false;
    for (let c = 0; c < lines[i].length; c++) {
      const ch = lines[i][c];
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    const obj: any = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = cells[j] || '';
    rows.push(obj);
  }
  return rows;
}

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner');
  const csvPath = path.join('/app/backend/data', 'export_items.csv');
  let content: string;
  try { content = await fs.readFile(csvPath, 'utf-8'); }
  catch { throw new HttpError(400, 'File katalog tidak ditemukan di server'); }
  const rows = parseCsv(content);
  const priceMap: Record<string, { price: number; cost: number }> = {};
  for (const row of rows) {
    const sku = (row.SKU || '').trim();
    if (sku) priceMap[sku] = { price: parseNum(row['Price [DANESWARA PRINTING]']), cost: parseNum(row.Cost) };
  }
  const products = await prisma.products.findMany({ where: { tenant_id: user.tenant_id } });
  let matched = 0; const unmatched: string[] = [];
  for (const p of products) {
    const m = priceMap[(p.sku || '').trim()];
    if (m) {
      matched++;
      await prisma.products.update({ where: { id: p.id }, data: { price: m.price, cost: m.cost } });
    } else {
      unmatched.push(p.name || p.sku || '?');
    }
  }
  await logActivity(user.tenant_id, user, 'Cocokkan Katalog', `${matched} produk diperbarui harga & biaya dari katalog`);
  return {
    ok: true, catalog_rows: Object.keys(priceMap).length, products: products.length,
    matched, unmatched_count: unmatched.length, unmatched: unmatched.slice(0, 30),
  };
});
