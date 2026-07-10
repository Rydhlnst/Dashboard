-- ============================================================
-- Dashboard Monitoring — FINAL MIGRATION (v1 + v2 + v3 merged)
-- Import sekali saja. Tidak perlu jalankan migrations.sql,
-- migration_v2.sql, atau migration_v3.sql secara terpisah.
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+07:00";
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- Table: users
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(255)  NOT NULL,
  `email`         VARCHAR(255)  NOT NULL,
  `password_hash` VARCHAR(255)  NOT NULL,
  `role`          ENUM('super_admin','admin','viewer') NOT NULL DEFAULT 'viewer',
  `status`        ENUM('active','inactive')            NOT NULL DEFAULT 'active',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: import_batches
-- ============================================================
CREATE TABLE IF NOT EXISTS `import_batches` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `file_name`       VARCHAR(255)  NOT NULL,
  `dataset_type`    VARCHAR(50)   NOT NULL DEFAULT 'closing',
  `total_rows`      INT UNSIGNED  NOT NULL DEFAULT 0,
  `success_rows`    INT UNSIGNED  NOT NULL DEFAULT 0,
  `failed_rows`     INT UNSIGNED  NOT NULL DEFAULT 0,
  `valid_rows`      INT UNSIGNED  NOT NULL DEFAULT 0,
  `warning_rows`    INT UNSIGNED  NOT NULL DEFAULT 0,
  `error_rows`      INT UNSIGNED  NOT NULL DEFAULT 0,
  `imported_rows`   INT UNSIGNED  NOT NULL DEFAULT 0,
  `batch_status`    VARCHAR(50)   NOT NULL DEFAULT 'uploading'
    COMMENT 'uploading | pending_validation | validated | importing | completed | discarded | failed',
  `column_map`      JSON          DEFAULT NULL
    COMMENT 'Detected {original_header: db_field_key} mapping',
  `unknown_columns` JSON          DEFAULT NULL
    COMMENT '{col_letter: {header, field_key_guess}} for unrecognised headers',
  `imported_by`     INT UNSIGNED  NOT NULL,
  `imported_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_import_batches_imported_by` (`imported_by`),
  CONSTRAINT `fk_import_batches_user` FOREIGN KEY (`imported_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: project_records
-- ============================================================
CREATE TABLE IF NOT EXISTS `project_records` (
  `id`                        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `dataset_type`              ENUM('closing','filter900','refinement') NOT NULL DEFAULT 'closing',
  `po_year`                   VARCHAR(10)     DEFAULT NULL,
  `import_batch_id`           INT UNSIGNED    DEFAULT NULL,
  `pdid`                      VARCHAR(100)    DEFAULT NULL,
  `caid`                      VARCHAR(100)    DEFAULT NULL,
  `scarlett_ioms_id_before`   VARCHAR(100)    DEFAULT NULL,
  `scarlett_ioms_id_final`    VARCHAR(100)    DEFAULT NULL,
  `status_po`                 VARCHAR(100)    DEFAULT NULL,
  `pono_tsel`                 VARCHAR(100)    DEFAULT NULL,
  `capex`                     DECIMAL(20,2)   DEFAULT NULL,
  `band`                      VARCHAR(50)     DEFAULT NULL,
  `sector`                    VARCHAR(50)     DEFAULT NULL,
  `project_category`          VARCHAR(100)    DEFAULT NULL,
  `sow_actual`                TEXT            DEFAULT NULL,
  `vendor_principle`          VARCHAR(100)    DEFAULT NULL,
  `cr_status`                 VARCHAR(100)    DEFAULT NULL,
  `status_eba_mapping`        VARCHAR(100)    DEFAULT NULL,
  `eba_mapping_number`        VARCHAR(100)    DEFAULT NULL,
  `donor_act_siteid`          VARCHAR(100)    DEFAULT NULL,
  `donor_nop`                 VARCHAR(100)    DEFAULT NULL,
  `donor_tp`                  VARCHAR(100)    DEFAULT NULL,
  `donor_progress`            VARCHAR(100)    DEFAULT NULL,
  `replan_dismantle`          VARCHAR(100)    DEFAULT NULL,
  `donor_dismantle_actual`    VARCHAR(100)    DEFAULT NULL,
  `siteid_po`                 VARCHAR(100)    DEFAULT NULL,
  `siteid_act`                VARCHAR(100)    DEFAULT NULL,
  `neid_act`                  VARCHAR(100)    DEFAULT NULL,
  `site_name`                 VARCHAR(255)    DEFAULT NULL,
  `infra_type`                VARCHAR(100)    DEFAULT NULL,
  `lat`                       DECIMAL(10,7)   DEFAULT NULL,
  `lng`                       DECIMAL(10,7)   DEFAULT NULL,
  `city`                      VARCHAR(100)    DEFAULT NULL,
  `province`                  VARCHAR(100)    DEFAULT NULL,
  `nop`                       VARCHAR(100)    DEFAULT NULL,
  `tp_detail`                 VARCHAR(255)    DEFAULT NULL,
  `rfs_actual`                DATE            DEFAULT NULL,
  `rfs_month`                 VARCHAR(20)     DEFAULT NULL,
  `mitra_impl`                VARCHAR(100)    DEFAULT NULL,
  `progress_act`              VARCHAR(100)    DEFAULT NULL,
  `progress_done_flag`        VARCHAR(10)     DEFAULT NULL COMMENT '1=RFS, 0=NY, x=Drop',
  `issue_category`            VARCHAR(100)    DEFAULT NULL,
  `notes_progress`            TEXT            DEFAULT NULL,
  `gap_analysis`              TEXT            DEFAULT NULL,
  `gap_closing`               TEXT            DEFAULT NULL,
  `blocking`                  TINYINT(1)      NOT NULL DEFAULT 0,
  `support_needed`            TEXT            DEFAULT NULL,
  `pic_blocking`              VARCHAR(255)    DEFAULT NULL,
  `detail_pic_blocking`       TEXT            DEFAULT NULL,
  `current_position`          VARCHAR(100)    DEFAULT NULL,
  `status_project`            VARCHAR(100)    DEFAULT NULL,
  `progress_closing`          VARCHAR(100)    DEFAULT NULL,
  `sub_progress_closing`      VARCHAR(100)    DEFAULT NULL,
  -- Acceptance milestone statuses
  `atp_status`                VARCHAR(100)    DEFAULT NULL,
  `atp_blocking`              TEXT            DEFAULT NULL,
  `atp_tagging_plan_ori`      DATE            DEFAULT NULL,
  `atp_tagging_replan`        DATE            DEFAULT NULL,
  `atp_tagging_done`          DATE            DEFAULT NULL,
  `atp_approved`              DATE            DEFAULT NULL,
  `lv_status`                 VARCHAR(100)    DEFAULT NULL,
  `lv_blocking`               TEXT            DEFAULT NULL,
  `elv_plan_ori`              DATE            DEFAULT NULL,
  `elv_replan`                DATE            DEFAULT NULL,
  `elv_approved`              DATE            DEFAULT NULL,
  `oac_status`                VARCHAR(100)    DEFAULT NULL,
  `oac_blocking`              TEXT            DEFAULT NULL,
  `oac_plan_ori`              DATE            DEFAULT NULL,
  `oac_replan`                DATE            DEFAULT NULL,
  `oac_approved`              DATE            DEFAULT NULL,
  `qc_status`                 VARCHAR(100)    DEFAULT NULL,
  `qc_blocking`               TEXT            DEFAULT NULL,
  `qc_plan_ori`               DATE            DEFAULT NULL,
  `qc_replan`                 DATE            DEFAULT NULL,
  `qc_sign`                   DATE            DEFAULT NULL,
  `sqac_status`               VARCHAR(100)    DEFAULT NULL,
  `sqac_blocking`             TEXT            DEFAULT NULL,
  `sqac_plan_ori`             DATE            DEFAULT NULL,
  `sqac_replan`               DATE            DEFAULT NULL,
  `sqac_approved`             DATE            DEFAULT NULL,
  `baut_status`               VARCHAR(100)    DEFAULT NULL,
  `baut_blocking`             TEXT            DEFAULT NULL,
  `baut_plan_ori`             DATE            DEFAULT NULL,
  `baut_replan`               DATE            DEFAULT NULL,
  `baut_approved`             DATE            DEFAULT NULL,
  `bast_status`               VARCHAR(100)    DEFAULT NULL,
  `bast_blocking`             TEXT            DEFAULT NULL,
  `bast_plan_ori`             DATE            DEFAULT NULL,
  `bast_replan`               DATE            DEFAULT NULL,
  `bast_approved`             DATE            DEFAULT NULL,
  -- Financial
  `price_po`                  DECIMAL(20,2)   DEFAULT NULL,
  `price_po_to_be_claim`      DECIMAL(20,2)   DEFAULT NULL,
  `price_bast`                DECIMAL(20,2)   DEFAULT NULL,
  `remaining_po`              DECIMAL(20,2)   DEFAULT NULL,
  `price_po_presales`         DECIMAL(20,2)   DEFAULT NULL,
  `wbs_level3`                VARCHAR(100)    DEFAULT NULL,
  `network_number`            VARCHAR(100)    DEFAULT NULL,
  `cid1`                      VARCHAR(100)    DEFAULT NULL,
  `cid1_price_bast`           DECIMAL(20,2)   DEFAULT NULL,
  `cid1_creation_date`        DATE            DEFAULT NULL,
  `cid1_approve_date`         DATE            DEFAULT NULL,
  `cid2`                      VARCHAR(100)    DEFAULT NULL,
  `cid2_price_bast`           DECIMAL(20,2)   DEFAULT NULL,
  `cid2_creation_date`        DATE            DEFAULT NULL,
  `cid2_approve_date`         DATE            DEFAULT NULL,
  -- Filter 900 & Refinement specific
  `remarks_sow`               TEXT            DEFAULT NULL,
  `replan_rfs`                DATE            DEFAULT NULL,
  `plan_po`                   DECIMAL(20,2)   DEFAULT NULL,
  `released_po`               DECIMAL(20,2)   DEFAULT NULL,
  -- Dynamic columns
  `custom_fields`             JSON            DEFAULT NULL,
  -- Metadata
  `created_by`                INT UNSIGNED    DEFAULT NULL,
  `updated_by`                INT UNSIGNED    DEFAULT NULL,
  `deleted_at`                DATETIME        DEFAULT NULL,
  `created_at`                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_record_dataset_pdid` (`dataset_type`, `pdid`),
  KEY `idx_pr_import_batch`    (`import_batch_id`),
  KEY `idx_pr_dataset_type`    (`dataset_type`),
  KEY `idx_pr_po_year`         (`po_year`),
  KEY `idx_pr_status_project`  (`status_project`),
  KEY `idx_pr_status_po`       (`status_po`),
  KEY `idx_pr_province`        (`province`),
  KEY `idx_pr_city`            (`city`),
  KEY `idx_pr_mitra_impl`      (`mitra_impl`),
  KEY `idx_pr_project_category`(`project_category`),
  KEY `idx_pr_rfs_month`       (`rfs_month`),
  KEY `idx_pr_blocking`        (`blocking`),
  KEY `idx_pr_progress_flag`   (`progress_done_flag`),
  KEY `idx_pr_deleted_at`      (`deleted_at`),
  CONSTRAINT `fk_pr_import_batch` FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: import_staging
-- ============================================================
CREATE TABLE IF NOT EXISTS `import_staging` (
  `id`                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `batch_id`            INT UNSIGNED     NOT NULL,
  `row_number`          INT UNSIGNED     NOT NULL,
  `raw_data`            JSON             NOT NULL   COMMENT 'Original {header_text: value} pairs',
  `mapped_data`         JSON             DEFAULT NULL COMMENT '{field_key: value} after column map applied',
  `cleaned_data`        JSON             DEFAULT NULL COMMENT '{field_key: cleaned_value}',
  `status`              ENUM('pending','valid','warning','error','imported') NOT NULL DEFAULT 'pending',
  `validation_errors`   JSON             DEFAULT NULL COMMENT '[{field, message}]',
  `validation_warnings` JSON             DEFAULT NULL COMMENT '[{field, message}]',
  `imported_at`         DATETIME         DEFAULT NULL,
  `created_at`          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_staging_batch`        (`batch_id`),
  INDEX `idx_staging_batch_status` (`batch_id`, `status`),
  INDEX `idx_staging_status`       (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: user_chart_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_chart_preferences` (
  `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`      INT UNSIGNED  NOT NULL,
  `chart_key`    VARCHAR(100)  NOT NULL,
  `chart_type`   VARCHAR(50)   NOT NULL DEFAULT 'bar',
  `x_axis`       VARCHAR(100)  DEFAULT NULL,
  `y_axis`       VARCHAR(100)  DEFAULT NULL,
  `group_by`     VARCHAR(100)  DEFAULT NULL,
  `filters_json` JSON          DEFAULT NULL,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ucp_user_chart` (`user_id`, `chart_key`),
  KEY `idx_ucp_user_id` (`user_id`),
  CONSTRAINT `fk_ucp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: column_definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS `column_definitions` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `dataset_type`  VARCHAR(50)   NOT NULL DEFAULT 'all',
  `field_key`     VARCHAR(100)  NOT NULL,
  `label`         VARCHAR(255)  NOT NULL,
  `field_type`    ENUM('text','number','decimal','percentage','date','datetime','boolean','select','multi_select','textarea','url') NOT NULL DEFAULT 'text',
  `is_system`     TINYINT(1)   NOT NULL DEFAULT 0,
  `is_visible`    TINYINT(1)   NOT NULL DEFAULT 1,
  `is_filterable` TINYINT(1)   NOT NULL DEFAULT 0,
  `is_chartable`  TINYINT(1)   NOT NULL DEFAULT 0,
  `is_required`   TINYINT(1)   NOT NULL DEFAULT 0,
  `is_archived`   TINYINT(1)   NOT NULL DEFAULT 0,
  `default_value` TEXT          DEFAULT NULL,
  `options_json`  JSON          DEFAULT NULL,
  `sort_order`    INT UNSIGNED  NOT NULL DEFAULT 0,
  `column_group`  VARCHAR(100)  DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_col_key_dataset` (`field_key`, `dataset_type`),
  INDEX `idx_col_dataset`  (`dataset_type`),
  INDEX `idx_col_visible`  (`is_visible`),
  INDEX `idx_col_archived` (`is_archived`),
  INDEX `idx_col_sort`     (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED     DEFAULT NULL,
  `action`      VARCHAR(100)     NOT NULL,
  `entity`      VARCHAR(100)     DEFAULT NULL,
  `entity_id`   VARCHAR(100)     DEFAULT NULL,
  `description` TEXT             DEFAULT NULL,
  `ip_address`  VARCHAR(45)      DEFAULT NULL,
  `user_agent`  VARCHAR(500)     DEFAULT NULL,
  `created_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_al_user_id`    (`user_id`),
  KEY `idx_al_action`     (`action`),
  KEY `idx_al_created_at` (`created_at`),
  CONSTRAINT `fk_al_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: settings
-- ============================================================
CREATE TABLE IF NOT EXISTS `settings` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `setting_key`   VARCHAR(100)  NOT NULL,
  `setting_value` TEXT          DEFAULT NULL,
  `description`   VARCHAR(500)  DEFAULT NULL,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Seed: Default Settings
-- ============================================================
INSERT INTO `settings` (`setting_key`, `setting_value`, `description`) VALUES
('completed_uses_flag',            '1', 'If 1: use progress_done_flag=1 as completed. If 0: only use rfs_actual.'),
('completed_uses_rfs',             '1', 'If 1: use rfs_actual date as completed indicator.'),
('dropped_uses_status_po',         '1', 'If 1: Status PO = Drop means dropped.'),
('dropped_uses_flag_x',            '1', 'If 1: progress_done_flag = x means dropped.'),
('issue_check_pic_blocking',       '1', 'If 1: non-empty pic_blocking counts as issue.'),
('issue_check_acceptance_blocking','1', 'If 1: ATP/LV/OAC/QC/SQAC/BAUT/BAST blocking fields count as issue.'),
('issue_exclude_category',         '01. RFS', 'Issue category value that means no issue (already RFS).')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- ============================================================
-- Seed: Default Admin User
-- Email   : admin@example.com
-- Password: Admin@123456  ← GANTI setelah login pertama!
-- ============================================================
INSERT INTO `users` (`name`, `email`, `password_hash`, `role`, `status`) VALUES
('Administrator', 'admin@example.com', '$2y$12$4X3b/WVK/QgiSADHlYDWkuSuIDDoanNT/4ZrJlasSTcRGCbxf0ChK', 'admin', 'active')
ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `role` = 'admin',
  `status` = 'active';
