-- Mobile Platform Management (CMS storefront versi HP).
-- Aditif: hanya CREATE TABLE IF NOT EXISTS, tidak menyentuh tabel existing.
-- Di runtime, lib/mobileCms.ts (ensureMobileCmsSchema) menjalankan DDL yang sama
-- secara idempotent, jadi berkas ini hanya jejak riwayat / eksekusi manual.

CREATE TABLE IF NOT EXISTS `mobile_cms_products` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `slug` VARCHAR(200) NOT NULL,
  `category_id` VARCHAR(36) NULL,
  `description` TEXT NULL,
  `sku` VARCHAR(100) NULL,
  `price` FLOAT NOT NULL DEFAULT 0,
  `cost` FLOAT NOT NULL DEFAULT 0,
  `compare_price` FLOAT NOT NULL DEFAULT 0,
  `discount` FLOAT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `is_featured` BOOLEAN NOT NULL DEFAULT FALSE,
  `variants` TEXT NULL,
  `images` TEXT NULL,
  `main_image` TEXT NULL,
  `thumbnail_image` TEXT NULL,
  `banner_image` TEXT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `deleted_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL,
  `updated_at` DATETIME(0) NOT NULL,
  INDEX `ix_mobile_cms_products_tenant_id`(`tenant_id`),
  INDEX `ix_mobile_cms_products_sort`(`tenant_id`, `sort_order`),
  INDEX `ix_mobile_cms_products_status`(`tenant_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mobile_cms_categories` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `image` TEXT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `deleted_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL,
  `updated_at` DATETIME(0) NOT NULL,
  INDEX `ix_mobile_cms_categories_tenant_id`(`tenant_id`),
  INDEX `ix_mobile_cms_categories_sort`(`tenant_id`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mobile_cms_media` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `url` TEXT NOT NULL,
  `label` VARCHAR(200) NOT NULL DEFAULT '',
  `width` INTEGER NOT NULL DEFAULT 0,
  `height` INTEGER NOT NULL DEFAULT 0,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL,
  INDEX `ix_mobile_cms_media_tenant_id`(`tenant_id`),
  INDEX `ix_mobile_cms_media_sort`(`tenant_id`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mobile_cms_layout` (
  `tenant_id` VARCHAR(36) NOT NULL,
  `sections` TEXT NULL,
  `settings` TEXT NULL,
  `published` LONGTEXT NULL,
  `published_at` DATETIME(0) NULL,
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`tenant_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
