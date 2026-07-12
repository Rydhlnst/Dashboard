-- =============================================================================
-- migration_final.sql
-- Jalankan file ini di phpMyAdmin (pilih database rizkyynw_admin dulu).
-- Aman dijalankan berkali-kali (IF NOT EXISTS).
-- MariaDB 10.0+ compatible.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BAGIAN 1: Dynamic Dataset System
-- -----------------------------------------------------------------------------

-- Registry semua dynamic dataset
CREATE TABLE IF NOT EXISTS `datasets` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(200) NOT NULL,
  `slug`            VARCHAR(55)  NOT NULL,
  `table_name`      VARCHAR(64)  NOT NULL,
  `columns_schema`  LONGTEXT     NOT NULL,
  `primary_key_col` VARCHAR(64)  DEFAULT NULL,
  `row_count`       INT UNSIGNED NOT NULL DEFAULT 0,
  `created_by`      INT UNSIGNED DEFAULT NULL,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slug`       (`slug`),
  UNIQUE KEY `uq_table_name` (`table_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link import_batches ke datasets
ALTER TABLE `import_batches`
  ADD COLUMN IF NOT EXISTS `dataset_id` INT UNSIGNED DEFAULT NULL AFTER `id`;

ALTER TABLE `import_batches`
  ADD INDEX IF NOT EXISTS `idx_dataset_id` (`dataset_id`);


-- -----------------------------------------------------------------------------
-- BAGIAN 2: Saved Dynamic Charts
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `saved_charts` (
  `id`          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(200)     NOT NULL,
  `dataset_id`  INT UNSIGNED     NOT NULL,
  `chart_type`  VARCHAR(20)      NOT NULL DEFAULT 'bar',
  `x_col`       VARCHAR(64)      NOT NULL,
  `y_agg`       VARCHAR(10)      NOT NULL DEFAULT 'COUNT',
  `y_col`       VARCHAR(64)      DEFAULT NULL,
  `filter_col`  VARCHAR(64)      DEFAULT NULL,
  `filter_val`  VARCHAR(255)     DEFAULT NULL,
  `sort_by`     VARCHAR(20)      NOT NULL DEFAULT 'value_desc',
  `limit_rows`  TINYINT UNSIGNED NOT NULL DEFAULT 20,
  `created_by`  INT UNSIGNED     DEFAULT NULL,
  `created_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dataset_id` (`dataset_id`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
