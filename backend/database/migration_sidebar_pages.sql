-- =============================================================================
-- migration_sidebar_pages.sql
-- Jalankan di phpMyAdmin (pilih database rizkyynw_admin dulu).
-- Aman dijalankan berkali-kali (IF NOT EXISTS / IF EXISTS).
-- MariaDB 10.0+ compatible.
-- =============================================================================

-- Tambahkan kolom sidebar ke tabel datasets
ALTER TABLE `datasets`
  ADD COLUMN IF NOT EXISTS `page_label`      VARCHAR(200)      DEFAULT NULL          AFTER `primary_key_col`,
  ADD COLUMN IF NOT EXISTS `show_in_sidebar` TINYINT(1)        NOT NULL DEFAULT 1    AFTER `page_label`,
  ADD COLUMN IF NOT EXISTS `sidebar_sort`    SMALLINT UNSIGNED NOT NULL DEFAULT 100  AFTER `show_in_sidebar`;

ALTER TABLE `datasets`
  ADD INDEX IF NOT EXISTS `idx_show_in_sidebar` (`show_in_sidebar`);

-- Aktifkan semua dataset yang sudah ada agar muncul di sidebar
UPDATE `datasets` SET `show_in_sidebar` = 1 WHERE `show_in_sidebar` = 0;
