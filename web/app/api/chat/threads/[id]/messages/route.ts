/**
 * Chat admin — kirim balasan.
 *   POST /api/chat/threads/:id/messages   { body }
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { ensureChatSchema } from '@/lib/schemaGuard';
import {
  CHAT_SENDER, CHAT_STATUS, cleanBody, previewOf, serializeChatMessage, serializeChatThread,
} from '@/lib/chat';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: NextRequest, ctx: any) => {
  await ensureChatSchema();
  const user = await requireRoles(req, 'Owner', 'Manager', 'Kasir');
  const { id } = await ctx.params;
  const thread = await prisma.chat_threads.findFirst({ where: { id, tenant_id: user.tenant_id } });
  if (!thread) throw new HttpError(404, 'Percakapan tidak ditemukan');

  const data = await readBody(req);
  const body = cleanBody(data?.body);
  const now = new Date();

  const message = await prisma.chat_messages.create({
    data: {
      id: newId(),
      tenant_id: thread.tenant_id,
      thread_id: thread.id,
      sender: CHAT_SENDER.ADMIN,
      sender_name: user.name || 'Admin',
      body,
      created_at: now,
    },
  });

  const updated = await prisma.chat_threads.update({
    where: { id: thread.id },
    data: {
      status: CHAT_STATUS.OPEN,
      last_message_at: now,
      last_message_preview: previewOf(body),
      last_sender: CHAT_SENDER.ADMIN,
      unread_admin: 0,
      unread_customer: { increment: 1 },
      updated_at: now,
    },
  });

  return { thread: serializeChatThread(updated), message: serializeChatMessage(message) };
});
