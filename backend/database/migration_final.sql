-- =============================================================================
-- migration_final.sql
-- Jalankan file ini di phpMyAdmin (pilih database rizkyynw_admin dulu).
-- Aman dijalankan berkali-kali (IF NOT EXISTS / IF EXISTS).
-- MariaDB 10.0+ compatible.
--
-- Cakupan (untuk DB yang sudah ada / existing install):
--   BAGIAN 1 : Kolom tambahan di import_batches (dari migration_v2 & v3)
--   BAGIAN 2 : Tabel import_staging (dari migration_v3)
--   BAGIAN 3 : Unique index di project_records (dari migration_v3)
--   BAGIAN 4 : Dynamic Dataset System — tabel datasets (dari migration_datasets)
--   BAGIAN 5 : Kolom sidebar di datasets (dari migration_sidebar_pages)
--   BAGIAN 6 : Saved Dynamic Charts — tabel saved_charts (dari migration_charts)
-- =============================================================================


-- =============================================================================
-- BAGIAN 1: Kolom tambahan di import_batches
-- (migration_v2: dataset_type | migration_v3: column_map, batch_status, dll.)
-- =============================================================================

ALTER TABLE `import_batches`
  ADD COLUMN IF NOT EXISTS `dataset_id`      INT UNSIGNED  DEFAULT NULL     AFTER `id`,
  ADD COLUMN IF NOT EXISTS `dataset_type`    VARCHAR(50)   NOT NULL DEFAULT 'closing' AFTER `file_name`,
  ADD COLUMN IF NOT EXISTS `valid_rows`      INT UNSIGNED  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `warning_rows`    INT UNSIGNED  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `error_rows`      INT UNSIGNED  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `imported_rows`   INT UNSIGNED  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `column_map`      JSON          DEFAULT NULL
    COMMENT 'Detected {original_header: db_field_key} mapping',
  ADD COLUMN IF NOT EXISTS `unknown_columns` JSON          DEFAULT NULL
    COMMENT '{col_letter: {header, field_key_guess}}',
  ADD COLUMN IF NOT EXISTS `batch_status`    VARCHAR(50)   NOT NULL DEFAULT 'uploading'
    COMMENT 'uploading|pending_validation|validated|importing|completed|discarded|failed';

ALTER TABLE `import_batches`
  ADD INDEX IF NOT EXISTS `idx_dataset_id` (`dataset_id`);


-- =============================================================================
-- BAGIAN 2: Tabel import_staging
-- (dari migration_v3 — staging per-row validation pipeline)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `import_staging` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `batch_id`            INT UNSIGNED    NOT NULL,
  `row_number`          INT UNSIGNED    NOT NULL,
  `raw_data`            JSON            NOT NULL  COMMENT 'Original {header_text: value} pairs',
  `mapped_data`         JSON            DEFAULT NULL COMMENT '{field_key: value} after column map',
  `cleaned_data`        JSON            DEFAULT NULL COMMENT '{field_key: cleaned_value}',
  `status`              ENUM('pending','valid','warning','error','imported') NOT NULL DEFAULT 'pending',
  `validation_errors`   JSON            DEFAULT NULL COMMENT '[{field, message}]',
  `validation_warnings` JSON            DEFAULT NULL COMMENT '[{field, message}]',
  `imported_at`         DATETIME        DEFAULT NULL,
  `created_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_staging_batch`        (`batch_id`),
  KEY `idx_staging_batch_status` (`batch_id`, `status`),
  KEY `idx_staging_status`       (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- BAGIAN 3: Unique index di project_records
-- (dari migration_v3 — diperlukan untuk upsert di confirm step)
-- =============================================================================

-- Tambahkan hanya jika index belum ada
ALTER TABLE `project_records`
  ADD UNIQUE INDEX IF NOT EXISTS `uq_record_dataset_pdid` (`dataset_type`, `pdid`);


-- =============================================================================
-- BAGIAN 4: Dynamic Dataset System — tabel datasets
-- (dari migration_datasets.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `datasets` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(200) NOT NULL              COMMENT 'Human-readable name',
  `slug`            VARCHAR(55)  NOT NULL              COMMENT 'URL-safe slug derived from name',
  `table_name`      VARCHAR(64)  NOT NULL              COMMENT 'Actual table name, e.g. ds_closing_2026',
  `columns_schema`  LONGTEXT     NOT NULL              COMMENT 'JSON: [{col_name, col_type, label}, ...]',
  `primary_key_col` VARCHAR(64)  DEFAULT NULL          COMMENT 'Column used for upsert deduplication',
  `row_count`       INT UNSIGNED NOT NULL DEFAULT 0    COMMENT 'Cached row count',
  -- Sidebar columns (dari migration_sidebar_pages.sql)
  `page_label`      VARCHAR(200)      DEFAULT NULL,
  `show_in_sidebar` TINYINT(1)        NOT NULL DEFAULT 1,
  `sidebar_sort`    SMALLINT UNSIGNED NOT NULL DEFAULT 100,
  `created_by`      INT UNSIGNED DEFAULT NULL,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slug`            (`slug`),
  UNIQUE KEY `uq_table_name`      (`table_name`),
  KEY `idx_show_in_sidebar`       (`show_in_sidebar`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- BAGIAN 5: Kolom sidebar di datasets
-- (untuk DB yang sudah punya tabel datasets tapi belum punya kolom ini)
-- Aman jika tabel baru dibuat di BAGIAN 4 — IF NOT EXISTS akan skip.
-- =============================================================================

ALTER TABLE `datasets`
  ADD COLUMN IF NOT EXISTS `page_label`      VARCHAR(200)      DEFAULT NULL          AFTER `primary_key_col`,
  ADD COLUMN IF NOT EXISTS `show_in_sidebar` TINYINT(1)        NOT NULL DEFAULT 1    AFTER `page_label`,
  ADD COLUMN IF NOT EXISTS `sidebar_sort`    SMALLINT UNSIGNED NOT NULL DEFAULT 100  AFTER `show_in_sidebar`;

ALTER TABLE `datasets`
  ADD INDEX IF NOT EXISTS `idx_show_in_sidebar` (`show_in_sidebar`);

-- Aktifkan semua dataset yang sudah ada agar muncul di sidebar
UPDATE `datasets` SET `show_in_sidebar` = 1 WHERE `show_in_sidebar` = 0;


-- =============================================================================
-- BAGIAN 6: Saved Dynamic Charts — tabel saved_charts
-- (dari migration_charts.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `saved_charts` (
  `id`          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(200)     NOT NULL,
  `dataset_id`  INT UNSIGNED     NOT NULL                  COMMENT 'FK ke datasets.id',
  `chart_type`  VARCHAR(20)      NOT NULL DEFAULT 'bar'    COMMENT 'bar|line|area|pie|donut|radial',
  `x_col`       VARCHAR(64)      NOT NULL                  COMMENT 'Sanitized column name for GROUP BY',
  `y_agg`       VARCHAR(10)      NOT NULL DEFAULT 'COUNT'  COMMENT 'COUNT|SUM|AVG|MAX|MIN',
  `y_col`       VARCHAR(64)      DEFAULT NULL              COMMENT 'Numeric column for SUM/AVG/MAX/MIN; NULL for COUNT',
  `filter_col`  VARCHAR(64)      DEFAULT NULL,
  `filter_val`  VARCHAR(255)     DEFAULT NULL,
  `sort_by`     VARCHAR(20)      NOT NULL DEFAULT 'value_desc' COMMENT 'value_desc|value_asc|label_asc|label_desc',
  `limit_rows`  TINYINT UNSIGNED NOT NULL DEFAULT 20       COMMENT 'Max groups (max 200)',
  `created_by`  INT UNSIGNED     DEFAULT NULL,
  `created_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dataset_id` (`dataset_id`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SELESAI
-- =============================================================================
