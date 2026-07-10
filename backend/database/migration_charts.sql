-- ─────────────────────────────────────────────────────────────────────────────
-- migration_charts.sql — Saved Dynamic Charts
--
-- Run this in cPanel phpMyAdmin (after migration_datasets.sql).
-- MariaDB 10.0+ / MySQL 5.6+ compatible.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `saved_charts` (
  `id`          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(200)     NOT NULL                  COMMENT 'User-given name',
  `dataset_id`  INT UNSIGNED     NOT NULL                  COMMENT 'FK to datasets.id',
  `chart_type`  VARCHAR(20)      NOT NULL DEFAULT 'bar'    COMMENT 'bar|line|area|pie|donut|radial',
  `x_col`       VARCHAR(64)      NOT NULL                  COMMENT 'Sanitized column name for GROUP BY',
  `y_agg`       VARCHAR(10)      NOT NULL DEFAULT 'COUNT'  COMMENT 'COUNT|SUM|AVG|MAX|MIN',
  `y_col`       VARCHAR(64)      DEFAULT NULL              COMMENT 'Numeric column for SUM/AVG/MAX/MIN; NULL for COUNT',
  `filter_col`  VARCHAR(64)      DEFAULT NULL              COMMENT 'Column to filter on (optional)',
  `filter_val`  VARCHAR(255)     DEFAULT NULL              COMMENT 'Filter value (optional)',
  `sort_by`     VARCHAR(20)      NOT NULL DEFAULT 'value_desc' COMMENT 'value_desc|value_asc|label_asc|label_desc',
  `limit_rows`  TINYINT UNSIGNED NOT NULL DEFAULT 20       COMMENT 'Max groups to show (max 200)',
  `created_by`  INT UNSIGNED     DEFAULT NULL,
  `created_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dataset_id` (`dataset_id`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
