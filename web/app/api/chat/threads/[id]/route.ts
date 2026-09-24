/**
 * Chat admin — isi satu percakapan & ubah statusnya.
 *   GET   /api/chat/threads/:id        pesan + detail (menandai sudah dibaca)
 *   PATCH /api/chat/threads/:id        { status: 'open' | 'closed' }
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { ensureChatSchema } from '@/lib/schemaGuard';
import { CHAT_STATUS, serializeChatMessage, serializeChatThread } from '@/lib/chat';

export const dynamic = 'force-dynamic';

async function findThread(id: string, tenantId: string) {
  const thread = await prisma.chat_threads.findFirst({ where: { id, tenant_id: tenantId } });
  if (!thread) throw new HttpError(404, 'Percakapan tidak ditemukan');
  return thread;
}

export const GET = handle(async (req: NextRequest, ctx: any) => {
  await ensureChatSchema();
  const user = await getCurrentUser(req);
  const { id } = await ctx.params;
  const thread = await findThread(id, user.tenant_id);

  const rows = await prisma.chat_messages.findMany({
    where: { thread_id: thread.id },
    orderBy: { created_at: 'asc' },
    take: 300,
  });

  let unreadAdmin = Number(thread.unread_admin || 0);
  if (unreadAdmin > 0) {
    await prisma.chat_threads.update({
      where: { id: thread.id },
      data: { unread_admin: 0, updated_at: new Date() },
    });
    unreadAdmin = 0;
  }

  return {
    thread: serializeChatThread({ ...thread, unread_admin: unreadAdmin }),
    messages: rows.map(serializeChatMessage),
  };
});

export const PATCH = handle(async (req: NextRequest, ctx: any) => {
  await ensureChatSchema();
  const user = await requireRoles(req, 'Owner', 'Manager', 'Kasir');
  const { id } = await ctx.params;
  const thread = await findThread(id, user.tenant_id);
  const data = await readBody(req);
  const status = String(data?.status || '').toLowerCase();
  if (status !== CHAT_STATUS.OPEN && status !== CHAT_STATUS.CLOSED) {
    throw new HttpError(400, "Status hanya boleh 'open' atau 'closed'");
  }
  const updated = await prisma.chat_threads.update({
    where: { id: thread.id },
    data: { status, updated_at: new Date() },
  });
  return serializeChatThread(updated);
});
