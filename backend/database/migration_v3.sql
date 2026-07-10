-- =============================================================================
-- Dashboard Monitoring: Migration v3
-- Staging-based import pipeline with per-row validation
-- =============================================================================

-- Import staging: holds every row from an uploaded file before it enters project_records
CREATE TABLE IF NOT EXISTS import_staging (
  id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  batch_id            INT UNSIGNED     NOT NULL,
  `row_number`        INT UNSIGNED     NOT NULL,
  raw_data            JSON             NOT NULL COMMENT 'Original {header_text: value} pairs',
  mapped_data         JSON             DEFAULT NULL COMMENT '{field_key: value} after column map applied',
  cleaned_data        JSON             DEFAULT NULL COMMENT '{field_key: cleaned_value}',
  status              ENUM('pending','valid','warning','error','imported') NOT NULL DEFAULT 'pending',
  validation_errors   JSON             DEFAULT NULL COMMENT '[{field, message}]',
  validation_warnings JSON             DEFAULT NULL COMMENT '[{field, message}]',
  imported_at         DATETIME         DEFAULT NULL,
  created_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_staging_batch        (batch_id),
  INDEX idx_staging_batch_status (batch_id, status),
  INDEX idx_staging_status       (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Extend import_batches (standard MySQL 8 syntax — drop IF NOT EXISTS from ADD COLUMN)
ALTER TABLE import_batches
  ADD COLUMN column_map      JSON         DEFAULT NULL
    COMMENT 'Detected {original_header: db_field_key} mapping',
  ADD COLUMN unknown_columns JSON         DEFAULT NULL
    COMMENT '{col_letter: {header, field_key_guess}} for unrecognised headers',
  ADD COLUMN total_rows      INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN valid_rows      INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN warning_rows    INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN error_rows      INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN imported_rows   INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN batch_status    VARCHAR(50)  NOT NULL DEFAULT 'uploading'
    COMMENT 'uploading | pending_validation | validated | importing | completed | discarded | failed';


-- Unique composite key for upsert support in confirm step
ALTER TABLE project_records
  ADD UNIQUE INDEX uq_record_dataset_pdid (dataset_type, pdid);
