-- 2026-09-23 | custom_fonts
--
-- Tabel untuk fitur "Kelola Font" di desainer kaos (panel Teks pada
-- /custom-tees). Admin mengunggah berkas font sendiri, lalu font itu langsung
-- tersedia di dropdown "Jenis Font" untuk pelanggan di /custom.
--
-- Kolom:
--   name       nama tampilan yang dilihat admin & pelanggan (mis. "Bebas Neue")
--   family     nama CSS font-family unik per tenant (mis. "dnsw-bebas-neue")
--   file_url   lokasi berkas di R2 / disk
--   format     woff2 | woff | ttf | otf  (woff2 paling dianjurkan)
--   file_size  ukuran berkas dalam byte, untuk ditampilkan di UI
--
-- Berkasnya TIDAK disajikan langsung dari URL R2, melainkan lewat
-- GET /api/public/fonts/:id/file supaya same-origin dan aturan @font-face
-- tidak terhalang CORS.
--
-- Tidak ada perubahan pada tabel lain, jadi aman untuk database produksi.
--
-- Cara menerapkan (lihat juga DEPLOY.md bagian "Perubahan skema database"):
--   mysql -h <host> -P <port> -u <user> -p default < web/prisma/sql/2026-09-23_custom_fonts.sql

CREATE TABLE IF NOT EXISTS `custom_fonts` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `family` VARCHAR(80) NOT NULL,
    `file_url` TEXT NOT NULL,
    `format` VARCHAR(10) NOT NULL,
    `file_size` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `ix_custom_fonts_tenant_id`(`tenant_id`),
    INDEX `ix_custom_fonts_sort_order`(`sort_order`),
    UNIQUE INDEX `uq_custom_fonts_family`(`tenant_id`, `family`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
