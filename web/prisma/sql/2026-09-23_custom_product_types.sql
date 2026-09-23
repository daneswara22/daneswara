-- 2026-09-23 | Jenis Produk (custom tee): info produk + varian warna + size chart
--
-- Latar belakang: halaman admin `/app/mockup-kaos` (dulu "Mockup Kaos") diubah
-- menjadi "Jenis Produk". Admin sekarang bisa CRUD jenis produk beserta varian
-- warna dan size chart-nya, lalu data itu dipakai oleh `/price-list` dan tombol
-- "Ganti Produk" di `/custom`.
--
-- Perubahan:
--   1. ALTER  `custom_products`  -> tambah kolom info produk (aditif, NULL/DEFAULT
--      semua, jadi baris lama tetap valid).
--   2. CREATE `custom_product_colors` -> varian warna + thumbnail tampak depan.
--   3. CREATE `custom_product_sizes`  -> size chart (lebar dada & panjang, cm).
--
-- Tidak ada DROP kolom/tabel, jadi data produksi aman.
--
-- Cara menerapkan (lihat juga DEPLOY.md bagian "Perubahan skema database"):
--   mysql -h <host> -P <port> -u <user> -p default < web/prisma/sql/2026-09-23_custom_product_types.sql
--
-- Catatan: blok ALTER memakai prosedur kecil supaya aman dijalankan berulang
-- (MariaDB belum mendukung `ADD COLUMN IF NOT EXISTS` di semua versi lama).

DELIMITER $$
DROP PROCEDURE IF EXISTS dnsw_add_col $$
CREATE PROCEDURE dnsw_add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', ddl);
    PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END $$
DELIMITER ;

CALL dnsw_add_col('custom_products', 'subtitle',      'VARCHAR(200) NULL');
CALL dnsw_add_col('custom_products', 'price',         'INTEGER NOT NULL DEFAULT 0');
CALL dnsw_add_col('custom_products', 'supplier',      'VARCHAR(200) NULL');
CALL dnsw_add_col('custom_products', 'size_region',   'VARCHAR(120) NULL');
CALL dnsw_add_col('custom_products', 'model',         'VARCHAR(200) NULL');
CALL dnsw_add_col('custom_products', 'material',      'VARCHAR(200) NULL');
CALL dnsw_add_col('custom_products', 'thumbnail_url', 'TEXT NULL');
CALL dnsw_add_col('custom_products', 'is_active',     'BOOLEAN NOT NULL DEFAULT TRUE');
CALL dnsw_add_col('custom_products', 'sort_order',    'INTEGER NOT NULL DEFAULT 0');

DROP PROCEDURE IF EXISTS dnsw_add_col;

CREATE INDEX IF NOT EXISTS `ix_custom_products_sort_order` ON `custom_products` (`sort_order`);

CREATE TABLE IF NOT EXISTS `custom_product_colors` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `hex` VARCHAR(9) NOT NULL,
    `thumb_url` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `ix_custom_product_colors_tenant_id`(`tenant_id`),
    INDEX `ix_custom_product_colors_product_id`(`product_id`),
    UNIQUE INDEX `uq_custom_product_colors_slot`(`product_id`, `hex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `custom_product_sizes` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL,
    `label` VARCHAR(20) NOT NULL,
    `chest_cm` FLOAT NOT NULL DEFAULT 0,
    `length_cm` FLOAT NOT NULL DEFAULT 0,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `ix_custom_product_sizes_tenant_id`(`tenant_id`),
    INDEX `ix_custom_product_sizes_product_id`(`product_id`),
    UNIQUE INDEX `uq_custom_product_sizes_slot`(`product_id`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `custom_product_colors`
  ADD CONSTRAINT `custom_product_colors_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `custom_products`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `custom_product_sizes`
  ADD CONSTRAINT `custom_product_sizes_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `custom_products`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
