/**
 * Chat admin — daftar percakapan.
 *   GET /api/chat/threads?status=open|closed|all&q=kata
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { ensureChatSchema } from '@/lib/schemaGuard';
import { CHAT_STATUS, serializeChatThread } from '@/lib/chat';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: NextRequest) => {
  await ensureChatSchema();
  const user = await getCurrentUser(req);
  const url = new URL(req.url);
  const status = (url.searchParams.get('status') || 'all').toLowerCase();
  const q = (url.searchParams.get('q') || '').trim();

  const where: any = { tenant_id: user.tenant_id };
  if (status === CHAT_STATUS.OPEN || status === CHAT_STATUS.CLOSED) where.status = status;
  if (q) {
    where.OR = [
      { customer_name: { contains: q } },
      { customer_contact: { contains: q } },
      { ticket_code: { contains: q.toUpperCase() } },
      { last_message_preview: { contains: q } },
    ];
  }

  const rows = await prisma.chat_threads.findMany({
    where,
    orderBy: { last_message_at: 'desc' },
    take: 200,
  });

  return {
    items: rows.map((r) => serializeChatThread(r)),
    total: rows.length,
    unread_threads: rows.filter((r) => Number(r.unread_admin || 0) > 0).length,
  };
});
