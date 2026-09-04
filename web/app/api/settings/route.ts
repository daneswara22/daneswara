import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { newId } from '@/lib/http';
import { storage } from '@/lib/storage';
import { settingsInputSchema } from '@/lib/schemas';
import { serializeSettings, serializeUserSettings } from '@/lib/serializers';

const PRINTER_FIELDS = new Set(['print_mode', 'paper_width', 'printers', 'active_printer']);

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const tid = user.tenant_id;
  const s = await prisma.settings.findUnique({ where: { tenant_id: tid } });
  const out: any = s ? serializeSettings(s) : { tenant_id: tid };
  const us = await prisma.user_settings.findFirst({ where: { tenant_id: tid, user_id: user.id } });
  if (us) {
    const d: any = serializeUserSettings(us);
    for (const f of PRINTER_FIELDS) {
      if (d[f] != null) out[f] = d[f];
    }
  }
  return out;
});

export const PUT = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const tid = user.tenant_id;
  const body = settingsInputSchema.parse(await readBody(req));
  const upd: any = {};
  for (const [k, v] of Object.entries(body)) if (v !== undefined && v !== null) upd[k] = v;
  const printerPatch: any = {};
  const bizPatch: any = {};
  for (const [k, v] of Object.entries(upd)) {
    if (PRINTER_FIELDS.has(k)) printerPatch[k] = v; else bizPatch[k] = v;
  }
  if (Object.keys(printerPatch).length) {
    if (printerPatch.printers != null && typeof printerPatch.printers !== 'string') {
      printerPatch.printers = JSON.stringify(printerPatch.printers);
    }
    const existing = await prisma.user_settings.findFirst({ where: { tenant_id: tid, user_id: user.id } });
    if (existing) {
      await prisma.user_settings.update({ where: { id: existing.id }, data: printerPatch });
    } else {
      await prisma.user_settings.create({
        data: { id: newId(), tenant_id: tid, user_id: user.id, ...printerPatch },
      });
    }
  }
  if (Object.keys(bizPatch).length && (user.role === 'Owner' || user.role === 'Manager')) {
    if ('logo' in bizPatch) {
      const existing = await prisma.settings.findUnique({ where: { tenant_id: tid } });
      const newLogo = await storage.normalizeImageField(bizPatch.logo, 'logo');
      if (existing?.logo && newLogo !== existing.logo) await storage.delete(existing.logo);
      bizPatch.logo = newLogo || '';
    }
    if (bizPatch.printers != null && typeof bizPatch.printers !== 'string') bizPatch.printers = JSON.stringify(bizPatch.printers);
    const existing = await prisma.settings.findUnique({ where: { tenant_id: tid } });
    if (existing) {
      await prisma.settings.update({ where: { tenant_id: tid }, data: bizPatch });
    } else {
      await prisma.settings.create({ data: { tenant_id: tid, ...bizPatch } });
    }
  }
  return { ok: true };
});
