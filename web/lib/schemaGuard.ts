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
