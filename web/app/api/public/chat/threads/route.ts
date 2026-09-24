/**
 * Chat pelanggan — mulai percakapan baru (tanpa login).
 *   POST /api/public/chat/threads   { name, contact, message }
 * Balasannya memuat KODE TIKET yang dipakai pelanggan untuk melanjutkan chat
 * dari perangkat mana pun.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { handle, readBody } from '@/lib/handler';
import { newId } from '@/lib/http';
import { ensureChatSchema } from '@/lib/schemaGuard';
import {
  CHAT_SENDER, CHAT_STATUS, cleanBody, cleanContact, cleanName, nextTicketCode,
  previewOf, resolveChatTenantId, serializeChatMessage, serializeChatThread,
} from '@/lib/chat';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: NextRequest) => {
  await ensureChatSchema();
  const data = await readBody(req);
  const name = cleanName(data?.name);
  const contact = cleanContact(data?.contact);
  const body = cleanBody(data?.message);

  const tenantId = await resolveChatTenantId();
  const code = await nextTicketCode(tenantId);
  const now = new Date();
  const threadId = newId();

  const thread = await prisma.chat_threads.create({
    data: {
      id: threadId,
      tenant_id: tenantId,
      ticket_code: code,
      customer_name: name,
      customer_contact: contact,
      status: CHAT_STATUS.OPEN,
      last_message_at: now,
      last_message_preview: previewOf(body),
      last_sender: CHAT_SENDER.CUSTOMER,
      unread_admin: 1,
      unread_customer: 0,
      created_at: now,
      updated_at: now,
    },
  });

  const message = await prisma.chat_messages.create({
    data: {
      id: newId(),
      tenant_id: tenantId,
      thread_id: threadId,
      sender: CHAT_SENDER.CUSTOMER,
      sender_name: name,
      body,
      created_at: now,
    },
  });

  return {
    thread: serializeChatThread(thread, { forCustomer: true }),
    messages: [serializeChatMessage(message)],
  };
});
