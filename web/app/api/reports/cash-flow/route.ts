import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { localRangeToUtc, parseDate } from '@/lib/business';

const NO_SOURCE = '(tanpa sumber dana)';

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const url = new URL(req.url);
  const startStr = url.searchParams.get('start'); const endStr = url.searchParams.get('end');
  const { s, e } = localRangeToUtc(startStr, endStr);
  const tid = user.tenant_id;

  // --- Penjualan (kas masuk) ---
  const saleWhere: { tenant_id: string; refunded: boolean; created_at?: { gte?: Date; lt?: Date } } = { tenant_id: tid, refunded: false };
  if (s || e) saleWhere.created_at = {};
  if (s) saleWhere.created_at!.gte = s;
  if (e) saleWhere.created_at!.lt = e;
  const sales = await prisma.sales.findMany({ where: saleWhere });
  const salesIn = (sales || []).reduce((a, x) => a + x.total, 0);

  // --- Pendapatan lain & pengeluaran (kas masuk/keluar berbasis tanggal lokal) ---
  const startDate = parseDate(startStr); const endDate = parseDate(endStr);
  const finWhere: { tenant_id: string; date?: { gte?: Date; lte?: Date } } = { tenant_id: tid };
  if (startDate || endDate) finWhere.date = {};
  if (startDate) finWhere.date!.gte = startDate;
  if (endDate) finWhere.date!.lte = endDate;
  const others = await prisma.other_income.findMany({ where: finWhere });
  const oiIn = (others || []).reduce((a, x) => a + x.amount, 0);
  const expenses = await prisma.expenses.findMany({ where: finWhere });
  const expByCat: Record<string, number> = {};
  for (const ex of expenses) expByCat[ex.category] = (expByCat[ex.category] || 0) + ex.amount;
  const expOut = (expenses || []).reduce((a, x) => a + x.amount, 0);

  // --- Pembelian / restok (kas keluar berdasarkan tanggal terima) ---
  const purchases = await prisma.purchases.findMany({ where: { tenant_id: tid, status: 'Diterima' } });
  const filtered = (purchases || []).filter((p) => {
    const ref = p.received_at || p.created_at;
    if (s && ref < s) return false;
    if (e && ref >= e) return false;
    return true;
  });
  const purchaseOut = (filtered || []).reduce((a, x) => a + (x.total || 0), 0);

  // --- Ringkasan per sumber dana ---
  // Kunci: nama sumber (metode pembayaran / rekening / kas).
  //  in  = uang masuk ke sumber dana ini (dari penjualan + pendapatan lain-lain)
  //  out = uang keluar dari sumber dana ini (dari pengeluaran + pembelian)
  //  net = in - out
  type Bucket = { source: string; in: number; out: number; net: number };
  const bucket: Record<string, Bucket> = {};
  const touch = (key: string) => {
    const k = key || NO_SOURCE;
    if (!bucket[k]) bucket[k] = { source: k, in: 0, out: 0, net: 0 };
    return bucket[k];
  };
  for (const x of sales) touch(x.payment_method || NO_SOURCE).in += x.total;
  for (const x of others) touch(x.fund_source || NO_SOURCE).in += x.amount;
  for (const x of expenses) touch(x.fund_source || NO_SOURCE).out += x.amount;
  // Pembelian belum punya kolom sumber dana; masukkan ke bucket "tanpa sumber dana"
  // supaya total tetap konsisten dengan grand-total arus kas.
  for (const p of filtered) touch(NO_SOURCE).out += p.total || 0;
  for (const k of Object.keys(bucket)) bucket[k].net = bucket[k].in - bucket[k].out;

  // Urutkan: sumber dana bernama dulu (net menurun), lalu "(tanpa sumber dana)" terakhir.
  const bySource: Bucket[] = Object.values(bucket).sort((a, b) => {
    if (a.source === NO_SOURCE && b.source !== NO_SOURCE) return 1;
    if (b.source === NO_SOURCE && a.source !== NO_SOURCE) return -1;
    return Math.abs(b.net) - Math.abs(a.net);
  });

  const inflow = salesIn + oiIn;
  const outflow = purchaseOut + expOut;
  return {
    inflow: { sales: salesIn, other_income: oiIn, total: inflow },
    outflow: {
      purchases: purchaseOut, expenses: expOut, total: outflow,
      expenses_by_category: Object.entries(expByCat).map(([category, amount]) => ({ category, amount })),
    },
    by_source: bySource,
    net_cash: inflow - outflow,
    sales_count: sales.length, purchase_count: filtered.length, expense_count: expenses.length,
  };
});
