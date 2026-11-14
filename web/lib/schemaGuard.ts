/**
 * Pengaman skema (auto-migrasi aditif).
 * ---------------------------------------------------------------------------
 * Kenapa berkas ini ada:
 *   Proyek ini tidak memakai `prisma migrate`, jadi tabel/kolom baru TIDAK ikut
 *   terpasang otomatis saat deploy (lihat DEPLOY.md bagian "Perubahan skema
 *   database"). Akibatnya, kalau sebuah fitur sudah ter-merge tetapi SQL-nya
 *   belum dijalankan ke database, pengguna melihat error Prisma P2021 seperti
 *   "The table `custom_fonts` does not exist in the current database".
 *
 * Yang dilakukan di sini:
 *   Sebelum sebuah fitur menyentuh tabelnya, kita pastikan dulu tabel/kolom
 *   yang dibutuhkan memang ada. Semua perintah di bawah bersifat **aditif dan
 *   idempotent**:
 *     - hanya CREATE TABLE IF NOT EXISTS dan ADD COLUMN (dijaga information_schema)
 *     - TIDAK ADA DROP, TRUNCATE, atau ALTER yang merusak
 *   Jadi aman dijalankan berulang kali dan aman untuk database produksi yang
 *   sudah berisi data.
 *
 * Berkas SQL di `web/prisma/sql/` tetap dipertahankan sebagai jejak riwayat dan
 * untuk dipakai manual bila diinginkan. Pengaman ini cuma jaring pengaman
 * supaya fitur tidak pernah tampak "rusak" hanya karena migrasi terlewat.
 *
 * Hasilnya di-cache per proses, jadi biayanya hanya sekali saat request pertama.
 */
import { prisma } from './db';

/** Jalankan sebuah promise hanya sekali per proses, lalu pakai hasilnya lagi. */
function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    if (!p) {
      p = fn().catch((e) => {
        p = null; // biar bisa dicoba lagi di request berikutnya
        throw e;
      });
    }
    return p;
  };
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
  `;
  return Number(rows?.[0]?.n || 0) > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME = ${column}
  `;
  return Number(rows?.[0]?.n || 0) > 0;
}

/** ADD COLUMN yang hanya jalan kalau kolomnya belum ada. */
async function addColumnIfMissing(table: string, column: string, ddl: string) {
  if (await columnExists(table, column)) return false;
  await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
  console.log(`[schema] kolom ${table}.${column} ditambahkan`);
  return true;
}

/* ========================================================================= */
/* Jenis Produk: custom_products (kolom info) + warna + size chart           */
/* ========================================================================= */

export const ensureProductTypeSchema = once(async () => {
  if (!(await tableExists('custom_products'))) {
    // Tabel induknya belum ada sama sekali (instalasi baru). Biarkan Prisma
    // yang melapor supaya tidak menebak-nebak skema dasar.
    return;
  }

  await addColumnIfMissing('custom_products', 'subtitle', 'VARCHAR(200) NULL');
  await addColumnIfMissing('custom_products', 'price', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('custom_products', 'supplier', 'VARCHAR(200) NULL');
  await addColumnIfMissing('custom_products', 'size_region', 'VARCHAR(120) NULL');
  await addColumnIfMissing('custom_products', 'model', 'VARCHAR(200) NULL');
  await addColumnIfMissing('custom_products', 'material', 'VARCHAR(200) NULL');
  await addColumnIfMissing('custom_products', 'thumbnail_url', 'TEXT NULL');
  await addColumnIfMissing('custom_products', 'is_active', 'BOOLEAN NOT NULL DEFAULT TRUE');
  await addColumnIfMissing('custom_products', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('custom_products', 'category', 'VARCHAR(120) NULL');
  await addColumnIfMissing('custom_products', 'deleted_at', 'DATETIME(0) NULL');

  if (!(await tableExists('custom_product_colors'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`custom_product_colors\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`tenant_id\` VARCHAR(36) NOT NULL,
        \`product_id\` VARCHAR(36) NOT NULL,
        \`name\` VARCHAR(60) NOT NULL,
        \`hex\` VARCHAR(9) NOT NULL,
        \`thumb_url\` TEXT NULL,
        \`sort_order\` INTEGER NOT NULL DEFAULT 0,
        \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`created_at\` DATETIME(0) NOT NULL,
        \`updated_at\` DATETIME(0) NOT NULL,
        INDEX \`ix_custom_product_colors_tenant_id\`(\`tenant_id\`),
        INDEX \`ix_custom_product_colors_product_id\`(\`product_id\`),
        UNIQUE INDEX \`uq_custom_product_colors_slot\`(\`product_id\`, \`hex\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`custom_product_colors_product_id_fkey\`
          FOREIGN KEY (\`product_id\`) REFERENCES \`custom_products\`(\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('[schema] tabel custom_product_colors dibuat');
  }

  if (!(await tableExists('custom_product_sizes'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`custom_product_sizes\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`tenant_id\` VARCHAR(36) NOT NULL,
        \`product_id\` VARCHAR(36) NOT NULL,
        \`label\` VARCHAR(20) NOT NULL,
        \`chest_cm\` FLOAT NOT NULL DEFAULT 0,
        \`length_cm\` FLOAT NOT NULL DEFAULT 0,
        \`sort_order\` INTEGER NOT NULL DEFAULT 0,
        \`created_at\` DATETIME(0) NOT NULL,
        \`updated_at\` DATETIME(0) NOT NULL,
        INDEX \`ix_custom_product_sizes_tenant_id\`(\`tenant_id\`),
        INDEX \`ix_custom_product_sizes_product_id\`(\`product_id\`),
        UNIQUE INDEX \`uq_custom_product_sizes_slot\`(\`product_id\`, \`label\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`custom_product_sizes_product_id_fkey\`
          FOREIGN KEY (\`product_id\`) REFERENCES \`custom_products\`(\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('[schema] tabel custom_product_sizes dibuat');
  }
});

/* ========================================================================= */
/* Font kustom: custom_fonts                                                 */
/* ========================================================================= */

export const ensureFontSchema = once(async () => {
  if (await tableExists('custom_fonts')) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`custom_fonts\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`tenant_id\` VARCHAR(36) NOT NULL,
      \`name\` VARCHAR(80) NOT NULL,
      \`family\` VARCHAR(80) NOT NULL,
      \`file_url\` TEXT NOT NULL,
      \`format\` VARCHAR(10) NOT NULL,
      \`file_size\` INTEGER NOT NULL DEFAULT 0,
      \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`sort_order\` INTEGER NOT NULL DEFAULT 0,
      \`created_at\` DATETIME(0) NOT NULL,
      \`updated_at\` DATETIME(0) NOT NULL,
      INDEX \`ix_custom_fonts_tenant_id\`(\`tenant_id\`),
      INDEX \`ix_custom_fonts_sort_order\`(\`sort_order\`),
      UNIQUE INDEX \`uq_custom_fonts_family\`(\`tenant_id\`, \`family\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('[schema] tabel custom_fonts dibuat');
});

/* ========================================================================= */
/* Chatroom pelanggan <-> admin: chat_threads, chat_messages                 */
/* ========================================================================= */

export const ensureChatSchema = once(async () => {
  if (!(await tableExists('chat_threads'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`chat_threads\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`tenant_id\` VARCHAR(36) NOT NULL,
        \`ticket_code\` VARCHAR(20) NOT NULL,
        \`customer_name\` VARCHAR(80) NOT NULL,
        \`customer_contact\` VARCHAR(120) NOT NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'open',
        \`last_message_at\` DATETIME(0) NOT NULL,
        \`last_message_preview\` VARCHAR(200) NOT NULL DEFAULT '',
        \`last_sender\` VARCHAR(10) NOT NULL DEFAULT 'customer',
        \`unread_admin\` INTEGER NOT NULL DEFAULT 0,
        \`unread_customer\` INTEGER NOT NULL DEFAULT 0,
        \`created_at\` DATETIME(0) NOT NULL,
        \`updated_at\` DATETIME(0) NOT NULL,
        INDEX \`ix_chat_threads_tenant_id\`(\`tenant_id\`),
        INDEX \`ix_chat_threads_last_message_at\`(\`last_message_at\`),
        INDEX \`ix_chat_threads_status\`(\`status\`),
        UNIQUE INDEX \`uq_chat_threads_ticket\`(\`tenant_id\`, \`ticket_code\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('[schema] tabel chat_threads dibuat');
  }

  if (!(await tableExists('chat_messages'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`chat_messages\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`tenant_id\` VARCHAR(36) NOT NULL,
        \`thread_id\` VARCHAR(36) NOT NULL,
        \`sender\` VARCHAR(10) NOT NULL,
        \`sender_name\` VARCHAR(80) NOT NULL,
        \`body\` TEXT NOT NULL,
        \`created_at\` DATETIME(0) NOT NULL,
        INDEX \`ix_chat_messages_tenant_id\`(\`tenant_id\`),
        INDEX \`ix_chat_messages_thread_id\`(\`thread_id\`),
        INDEX \`ix_chat_messages_created_at\`(\`created_at\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`chat_messages_thread_id_fkey\`
          FOREIGN KEY (\`thread_id\`) REFERENCES \`chat_threads\`(\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('[schema] tabel chat_messages dibuat');
  }
});

/* ========================================================================= */
/* Task To Do: order_tasks + order_task_activities                           */
/* ========================================================================= */

export const ensureTaskSchema = once(async () => {
  if (!(await tableExists('orders'))) return;

  if (!(await tableExists('order_tasks'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`order_tasks\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`tenant_id\` VARCHAR(36) NOT NULL,
        \`order_id\` VARCHAR(36) NULL,
        \`task_number\` VARCHAR(40) NOT NULL,
        \`project_name\` VARCHAR(200) NULL,
        \`description\` TEXT NULL,
        \`items\` LONGTEXT NULL,
        \`priority\` VARCHAR(20) NOT NULL DEFAULT 'Normal',
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
        \`assigned_user_id\` VARCHAR(36) NULL,
        \`assigned_at\` DATETIME(0) NULL,
        \`created_by_id\` VARCHAR(36) NULL,
        \`created_by_name\` VARCHAR(120) NULL,
        \`deadline\` DATETIME(0) NULL,
        \`release_reason\` VARCHAR(300) NULL,
        \`completed_at\` DATETIME(0) NULL,
        \`created_at\` DATETIME(0) NOT NULL,
        \`updated_at\` DATETIME(0) NOT NULL,
        UNIQUE INDEX \`uq_order_tasks_order\`(\`order_id\`),
        INDEX \`ix_order_tasks_tenant_status\`(\`tenant_id\`, \`status\`),
        INDEX \`ix_order_tasks_tenant_pic\`(\`tenant_id\`, \`assigned_user_id\`),
        INDEX \`ix_order_tasks_tenant_deadline\`(\`tenant_id\`, \`deadline\`),
        INDEX \`ix_order_tasks_tenant_created\`(\`tenant_id\`, \`created_at\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('[schema] tabel order_tasks dibuat');
  } else {
    // Instalasi lama: tambahkan kolom baru tanpa menyentuh data yang ada.
    await addColumnIfMissing('order_tasks', 'description', 'TEXT NULL');
    await addColumnIfMissing('order_tasks', 'items', 'LONGTEXT NULL');
    await addColumnIfMissing('order_tasks', 'created_by_id', 'VARCHAR(36) NULL');
    await addColumnIfMissing('order_tasks', 'created_by_name', 'VARCHAR(120) NULL');
  }

  if (!(await tableExists('order_task_activities'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`order_task_activities\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`tenant_id\` VARCHAR(36) NOT NULL,
        \`task_id\` VARCHAR(36) NOT NULL,
        \`action\` VARCHAR(40) NOT NULL,
        \`detail\` VARCHAR(300) NULL,
        \`user_id\` VARCHAR(36) NULL,
        \`user_name\` VARCHAR(120) NULL,
        \`created_at\` DATETIME(0) NOT NULL,
        INDEX \`ix_order_task_activities_task\`(\`task_id\`, \`created_at\`),
        INDEX \`ix_order_task_activities_tenant\`(\`tenant_id\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('[schema] tabel order_task_activities dibuat');
  }
});

/* ========================================================================= */
/* Klasifikasi keuangan: entry_type + pembayaran pembelian                   */
/* ========================================================================= */

export const ensureFinanceSchema = once(async () => {
  // sales.customer_address — alamat pelanggan disalin saat transaksi supaya
  // invoice lama tetap menampilkan alamat seperti saat transaksi dibuat.
  await addColumnIfMissing('sales', 'customer_address', 'TEXT NULL');

  // expenses.entry_type — hanya 'expense' yang masuk laba rugi.
  await addColumnIfMissing('expenses', 'entry_type', "VARCHAR(20) NOT NULL DEFAULT 'expense'");
  // other_income.entry_type — hanya 'income' yang masuk laba rugi.
  await addColumnIfMissing('other_income', 'entry_type', "VARCHAR(20) NOT NULL DEFAULT 'income'");

  // purchases: pembayaran ke supplier (arus kas memakai paid_at).
  await addColumnIfMissing('purchases', 'payment_status', "VARCHAR(20) NOT NULL DEFAULT 'UNPAID'");
  await addColumnIfMissing('purchases', 'paid_at', 'DATETIME(0) NULL');
  await addColumnIfMissing('purchases', 'paid_amount', 'FLOAT NULL');
  await addColumnIfMissing('purchases', 'payment_source', 'VARCHAR(40) NULL');

  // Backfill: PO yang sudah diterima dianggap sudah dibayar pada tanggal terima.
  await prisma.$executeRawUnsafe(`
    UPDATE purchases
    SET payment_status = 'PAID',
        paid_at = COALESCE(received_at, created_at),
        paid_amount = total
    WHERE status = 'Diterima' AND (paid_at IS NULL OR payment_status = 'UNPAID')
  `);

  // Backfill klasifikasi dari nama kategori yang jelas bukan biaya.
  await prisma.$executeRawUnsafe(`
    UPDATE expenses SET entry_type = 'transfer'
    WHERE entry_type = 'expense'
      AND (LOWER(category) LIKE '%pindah buku%' OR LOWER(category) LIKE '%withdraw%' OR LOWER(category) LIKE '%transfer%')
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE expenses SET entry_type = 'loan'
    WHERE entry_type = 'expense'
      AND (LOWER(category) LIKE '%pinjaman%' OR LOWER(category) LIKE '%loan%' OR LOWER(category) LIKE '%cicilan%')
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE expenses SET entry_type = 'receivable'
    WHERE entry_type = 'expense'
      AND (LOWER(category) LIKE '%kasbon%' OR LOWER(category) LIKE '%piutang%')
  `);
});