/**
 * Mobile Layout + Settings (draft) dan ringkasan seluruh data CMS.
 *   GET /api/mobile-cms/layout   -> { sections, settings, products, categories, media, stats }
 *   PUT /api/mobile-cms/layout   -> simpan draft urutan section & settings (Save Draft)
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { stringifyJson } from '@/lib/http';
import {
  ensureMobileCmsSchema,
  getDraft,
  getLayoutRow,
  normalizeSections,
  normalizeSettings,
  profitOf,
} from '@/lib/mobileCms';

const ROLES = ['Owner', 'Manager'] as const;

/** Ringkasan untuk tab Dashboard. */
function statsOf(draft: any) {
  const byStatus: Record<string, number> = { active: 0, draft: 0, hidden: 0, out_of_stock: 0 };
  let revenue = 0;
  let profit = 0;
  for (const p of draft.products) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    revenue += p.price;
    profit += profitOf(p.price, p.cost).profit;
  }
  return {
    products: draft.products.length,
    categories: draft.categories.length,
    media: draft.media.length,
    sections_enabled: draft.sections.filter((s: any) => s.enabled !== false).length,
    by_status: byStatus,
    featured: draft.products.filter((p: any) => p.is_featured).length,
    total_price: revenue,
    total_profit: profit,
    avg_margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
  };
}

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const draft = await getDraft(user.tenant_id);
  return { ...draft, stats: statsOf(draft) };
});

export const PUT = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  await getLayoutRow(user.tenant_id);
  const body = await readBody(req);
  const data: any = { updated_at: new Date() };
  if (body?.sections !== undefined) data.sections = stringifyJson(normalizeSections(body.sections));
  if (body?.settings !== undefined) data.settings = stringifyJson(normalizeSettings(body.settings));
  await prisma.mobile_cms_layout.update({ where: { tenant_id: user.tenant_id }, data });
  await logActivity(user.tenant_id, user, 'Simpan Draft Mobile Platform', '');
  const draft = await getDraft(user.tenant_id);
  return { ...draft, stats: statsOf(draft) };
});
