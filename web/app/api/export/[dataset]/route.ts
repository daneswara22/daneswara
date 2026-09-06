import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { localToday, localRangeToUtc, parseDate, safeJsonParse, toIsoUtc } from '@/lib/business';
import * as serializers from '@/lib/serializers';

const EXPORT_MAP: Record<string, { model: string; serialize: (r: any) => any }> = {
  sales: { model: 'sales', serialize: serializers.serializeSale },
  orders: { model: 'orders', serialize: serializers.serializeOrder },
  purchases: { model: 'purchases', serialize: serializers.serializePurchase },
  expenses: { model: 'expenses', serialize: serializers.serializeExpense },
  other_income: { model: 'other_income', serialize: serializers.serializeOtherIncome },
  stock_movements: { model: 'stock_movements', serialize: serializers.serializeStockMovement },
  products: { model: 'products', serialize: serializers.serializeProduct },
  categories: { model: 'categories', serialize: serializers.serializeCategory },
  customers: { model: 'customers', serialize: serializers.serializeCustomer },
  suppliers: { model: 'suppliers', serialize: serializers.serializeSupplier },
  users: { model: 'users', serialize: serializers.serializeUser },
  activities: { model: 'activities', serialize: serializers.serializeActivity },
};

const DATE_FILTER = new Set(['sales', 'orders', 'purchases', 'stock_movements', 'activities']);
const DATE_FIELD = new Set(['expenses', 'other_income']);

function csvCell(v: any): string {
  if (v == null) return '';
  if (Array.isArray(v) || typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v);
  if (s.startsWith('data:image')) return '[gambar tersimpan]';
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function docsToCsv(docs: any[]): string {
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const d of docs) {
    for (const k of Object.keys(d)) if (!seen.has(k)) { seen.add(k); headers.push(k); }
  }
  const lines = [headers.join(',')];
  for (const d of docs) lines.push(headers.map((h) => csvCell(d[h])).join(','));
  return lines.join('\n');
}

export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ dataset: string }> }) => {
  const { dataset } = await ctx.params;
  const user = await requireRoles(req, 'Owner');
  const cfg = EXPORT_MAP[dataset];
  if (!cfg) throw new HttpError(404, 'Jenis data tidak dikenal');
  const tid = user.tenant_id;
  const url = new URL(req.url);
  const startStr = url.searchParams.get('start'); const endStr = url.searchParams.get('end');
  const where: any = { tenant_id: tid };
  if (DATE_FILTER.has(dataset)) {
    const { s, e } = localRangeToUtc(startStr, endStr);
    if (s || e) where.created_at = {};
    if (s) where.created_at.gte = s;
    if (e) where.created_at.lt = e;
  } else if (DATE_FIELD.has(dataset)) {
    const s = parseDate(startStr); const e = parseDate(endStr);
    if (s || e) where.date = {};
    if (s) where.date.gte = s;
    if (e) where.date.lte = e;
  }
  const orderBy = (dataset === 'settings') ? undefined : { created_at: 'desc' as const };
  const rows = await (prisma as any)[cfg.model].findMany({ where, orderBy, take: 50000 });
  const docs = (rows || []).map(cfg.serialize);
  const body = '\uFEFF' + docsToCsv(docs);
  const filename = `${dataset}_${localToday()}.csv`;
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
