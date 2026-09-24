/**
 * Chat pelanggan — ambil percakapan lewat kode tiket.
 *   GET /api/public/chat/threads/DNS-7KQ4M2
 * Dipanggil berulang (polling ~3 detik) oleh widget chat. Setiap kali dibuka,
 * pesan admin dianggap sudah dibaca pelanggan.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { handle } from '@/lib/handler';
import { ensureChatSchema } from '@/lib/schemaGuard';
import { findThreadByCode, serializeChatMessage, serializeChatThread } from '@/lib/chat';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: NextRequest, ctx: any) => {
  await ensureChatSchema();
  const { code } = await ctx.params;
  const thread = await findThreadByCode(code);

  const rows = await prisma.chat_messages.findMany({
    where: { thread_id: thread.id },
    orderBy: { created_at: 'asc' },
    take: 300,
  });

  // Pelanggan sedang melihat percakapan -> tandai balasan admin sudah dibaca.
  let unreadCustomer = Number(thread.unread_customer || 0);
  if (unreadCustomer > 0) {
    await prisma.chat_threads.update({
      where: { id: thread.id },
      data: { unread_customer: 0, updated_at: new Date() },
    });
    unreadCustomer = 0;
  }

  return {
    thread: serializeChatThread({ ...thread, unread_customer: unreadCustomer }, { forCustomer: true }),
    messages: rows.map(serializeChatMessage),
  };
});
