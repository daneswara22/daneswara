-- 2026-09-24 | Chatroom pelanggan <-> admin
--
-- Latar belakang: pelanggan di website (landing, galeri, desainer kaos) perlu
-- bisa bertanya langsung ke admin tanpa membuat akun. Identitasnya memakai
-- KODE TIKET (mis. `DNS-7KQ4M2`) supaya percakapan bisa dilanjutkan dari
-- perangkat lain. Sisi admin membacanya di `/app/chat`.
--
-- Perubahan (aditif, tidak menyentuh tabel lain):
--   1. CREATE `chat_threads`  -> satu baris per percakapan/tiket.
--   2. CREATE `chat_messages` -> isi pesan, FK ke chat_threads (ON DELETE CASCADE).
--
-- Catatan: aplikasi juga punya jaring pengaman di `web/lib/schemaGuard.ts`
-- (`ensureChatSchema`) yang membuat kedua tabel ini otomatis bila belum ada,
-- jadi berkas ini hanya untuk dijalankan manual / jejak riwayat.

CREATE TABLE IF NOT EXISTS `chat_threads` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `ticket_code` VARCHAR(20) NOT NULL,
  `customer_name` VARCHAR(80) NOT NULL,
  `customer_contact` VARCHAR(120) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'open',
  `last_message_at` DATETIME(0) NOT NULL,
  `last_message_preview` VARCHAR(200) NOT NULL DEFAULT '',
  `last_sender` VARCHAR(10) NOT NULL DEFAULT 'customer',
  `unread_admin` INTEGER NOT NULL DEFAULT 0,
  `unread_customer` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL,
  `updated_at` DATETIME(0) NOT NULL,
  INDEX `ix_chat_threads_tenant_id`(`tenant_id`),
  INDEX `ix_chat_threads_last_message_at`(`last_message_at`),
  INDEX `ix_chat_threads_status`(`status`),
  UNIQUE INDEX `uq_chat_threads_ticket`(`tenant_id`, `ticket_code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `thread_id` VARCHAR(36) NOT NULL,
  `sender` VARCHAR(10) NOT NULL,
  `sender_name` VARCHAR(80) NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(0) NOT NULL,
  INDEX `ix_chat_messages_tenant_id`(`tenant_id`),
  INDEX `ix_chat_messages_thread_id`(`thread_id`),
  INDEX `ix_chat_messages_created_at`(`created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `chat_messages_thread_id_fkey`
    FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
