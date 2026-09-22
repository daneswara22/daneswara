-- 2026-09-22 | custom_tee_orders
--
-- Tabel untuk fitur Custom Tees (PR #29..#33). Kodenya sudah ter-merge ke `main`,
-- tetapi tabelnya belum pernah dibuat di database produksi, sehingga menekan
-- "Cek Harga" di /custom-tees memunculkan:
--
--   Invalid `prisma.custom_tee_orders.findFirst()` invocation:
--   The table `custom_tee_orders` does not exist in the current database.  (P2021)
--
-- Isi berkas ini dihasilkan oleh:
--   cd web && npx prisma migrate diff \
--     --from-url "$DATABASE_URL" \
--     --to-schema-datamodel prisma/schema.prisma --script
--
-- Sifatnya aditif: hanya CREATE TABLE, tidak ada ALTER/DROP, jadi data lama aman.
-- Aman dijalankan berulang karena memakai IF NOT EXISTS.
--
-- Cara menerapkan (lihat juga DEPLOY.md bagian "Perubahan skema database"):
--   mysql -h <host> -P <port> -u <user> -p default < web/prisma/sql/2026-09-22_custom_tee_orders.sql
--
-- Sudah diterapkan ke produksi pada 2026-09-22; setelah itu
-- `prisma migrate diff` melaporkan "This is an empty migration." (skema sinkron).

CREATE TABLE IF NOT EXISTS `custom_tee_orders` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `order_code` VARCHAR(40) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `customer_name` VARCHAR(160) NOT NULL,
    `customer_phone` VARCHAR(40) NOT NULL,
    `customer_email` VARCHAR(160) NULL,
    `product_key` VARCHAR(80) NOT NULL,
    `product_title` VARCHAR(200) NOT NULL,
    `size` VARCHAR(120) NOT NULL,
    `size_items_json` TEXT NULL,
    `qty` INTEGER NOT NULL DEFAULT 1,
    `color_name` VARCHAR(60) NOT NULL,
    `color_hex` VARCHAR(9) NOT NULL,
    `objects_count` INTEGER NOT NULL DEFAULT 0,
    `design_json` LONGTEXT NOT NULL,
    `note` TEXT NULL,
    `submitted_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `ix_custom_tee_orders_tenant_id`(`tenant_id`),
    INDEX `ix_custom_tee_orders_status`(`status`),
    INDEX `ix_custom_tee_orders_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
