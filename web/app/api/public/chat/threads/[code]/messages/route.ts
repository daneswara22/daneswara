/**
 * Chat pelanggan — kirim pesan baru memakai kode tiket.
 *   POST /api/public/chat/threads/DNS-7KQ4M2/messages   { body }
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { ensureChatSchema } from '@/lib/schemaGuard';
import {
  CHAT_SENDER, CHAT_STATUS, cleanBody, findThreadByCode, previewOf,
  serializeChatMessage, serializeChatThread,
} from '@/lib/chat';

export const dynamic = 'force-dynamic';

/* Pagar sederhana anti-spam: maksimal 20 pesan pelanggan per menit per tiket. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

export const POST = handle(async (req: NextRequest, ctx: any) => {
  await ensureChatSchema();
  const { code } = await ctx.params;
  const thread = await findThreadByCode(code);
  const data = await readBody(req);
  const body = cleanBody(data?.body);

  const recent = await prisma.chat_messages.count({
    where: {
      thread_id: thread.id,
      sender: CHAT_SENDER.CUSTOMER,
      created_at: { gte: new Date(Date.now() - RATE_WINDOW_MS) },
    },
  });
  if (recent >= RATE_MAX) throw new HttpError(429, 'Terlalu banyak pesan. Tunggu sebentar ya.');

  const now = new Date();
  const message = await prisma.chat_messages.create({
    data: {
      id: newId(),
      tenant_id: thread.tenant_id,
      thread_id: thread.id,
      sender: CHAT_SENDER.CUSTOMER,
      sender_name: thread.customer_name,
      body,
      created_at: now,
    },
  });

  const updated = await prisma.chat_threads.update({
    where: { id: thread.id },
    data: {
      // pelanggan membalas -> percakapan yang sudah ditutup dibuka lagi
      status: CHAT_STATUS.OPEN,
      last_message_at: now,
      last_message_preview: previewOf(body),
      last_sender: CHAT_SENDER.CUSTOMER,
      unread_admin: { increment: 1 },
      unread_customer: 0,
      updated_at: now,
    },
  });

  return {
    thread: serializeChatThread(updated, { forCustomer: true }),
    message: serializeChatMessage(message),
  };
});
