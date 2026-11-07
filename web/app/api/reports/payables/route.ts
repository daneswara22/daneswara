import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { ensureFinanceSchema } from '@/lib/schemaGuard';

/**
 * GET /api/reports/payables
 * Laporan utang supplier: PO yang sudah diterima tapi belum dibayar.
 * Ini kewajiban nyata yang tidak muncul di arus kas maupun laba rugi.
 */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  await ensureFinanceSchema();
  const tid = user.tenant_id;

  const rows = await prisma.purchases.findMany({
    where: {
      tenant_id: tid,
      status: 'Diterima',
      payment_status: { not: 'PAID' },
    },
    orderBy: [{ received_at: 'asc' }, { created_at: 'asc' }],
    take: 1000,
  });

  const items = rows.map((p) => ({
    id: p.id,
    po_number: p.po_number,
    supplier_name: p.supplier_name || '—',
    total: p.total,
    received_at: p.received_at,
    created_at: p.created_at,
    days_outstanding: p.received_at
      ? Math.floor((Date.now() - new Date(p.received_at).getTime()) / 86400000)
      : null,
  }));

  const total = items.reduce((s, x) => s + (Number(x.total) || 0), 0);

  // Ringkas per supplier supaya mudah ditagih/dibayar.
  const bySupplier: Record<string, { supplier: string; total: number; count: number }> = {};
  for (const it of items) {
    const k = it.supplier_name;
    if (!bySupplier[k]) bySupplier[k] = { supplier: k, total: 0, count: 0 };
    bySupplier[k].total += Number(it.total) || 0;
    bySupplier[k].count += 1;
  }

  return {
    total,
    count: items.length,
    items,
    by_supplier: Object.values(bySupplier).sort((a, b) => b.total - a.total),
  };
});
