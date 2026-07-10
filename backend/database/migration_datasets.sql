-- ─────────────────────────────────────────────────────────────────────────────
-- migration_datasets.sql — Dynamic Dataset System
--
-- Run this in cPanel phpMyAdmin (select your database first).
-- MariaDB 10.0+ / MySQL 5.6+ compatible.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Registry table for all dynamic datasets
CREATE TABLE IF NOT EXISTS `datasets` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(200) NOT NULL              COMMENT 'Human-readable name (e.g. "Closing Progress 2026")',
  `slug`            VARCHAR(55)  NOT NULL              COMMENT 'URL-safe slug derived from name',
  `table_name`      VARCHAR(64)  NOT NULL              COMMENT 'Actual table name, e.g. "ds_closing_progress_2026"',
  `columns_schema`  LONGTEXT     NOT NULL              COMMENT 'JSON: [{col_name, col_type, label}, ...]',
  `primary_key_col` VARCHAR(64)  DEFAULT NULL          COMMENT 'Column used for upsert deduplication (optional)',
  `row_count`       INT UNSIGNED NOT NULL DEFAULT 0    COMMENT 'Cached row count, updated on each confirm',
  `created_by`      INT UNSIGNED DEFAULT NULL,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slug`       (`slug`),
  UNIQUE KEY `uq_table_name` (`table_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Link import_batches to the dataset registry
--    MariaDB 10.0.2+ supports IF NOT EXISTS on ALTER
ALTER TABLE `import_batches`
  ADD COLUMN IF NOT EXISTS `dataset_id` INT UNSIGNED DEFAULT NULL AFTER `id`;

ALTER TABLE `import_batches`
  ADD INDEX IF NOT EXISTS `idx_dataset_id` (`dataset_id`);
