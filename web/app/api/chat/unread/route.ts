/**
 * Chat admin — ringkasan belum dibaca untuk badge sidebar & notifikasi.
 *   GET /api/chat/unread
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { ensureChatSchema } from '@/lib/schemaGuard';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: NextRequest) => {
  await ensureChatSchema();
  const user = await getCurrentUser(req);

  const rows = await prisma.chat_threads.findMany({
    where: { tenant_id: user.tenant_id, unread_admin: { gt: 0 } },
    orderBy: { last_message_at: 'desc' },
    select: {
      id: true, ticket_code: true, customer_name: true,
      unread_admin: true, last_message_preview: true, last_message_at: true,
    },
    take: 50,
  });

  const messages = rows.reduce((sum, r) => sum + Number(r.unread_admin || 0), 0);
  const latest = rows[0] || null;

  return {
    unread_threads: rows.length,
    unread_messages: messages,
    latest: latest
      ? {
          id: latest.id,
          ticket_code: latest.ticket_code,
          customer_name: latest.customer_name,
          preview: latest.last_message_preview || '',
          at: latest.last_message_at instanceof Date
            ? latest.last_message_at.toISOString()
            : String(latest.last_message_at),
        }
      : null,
  };
});
