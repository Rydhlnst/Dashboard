-- =============================================================================
-- Dashboard Monitoring — FULL INSTALL (Single File)
-- =============================================================================
-- Jalankan file ini SEKALI di phpMyAdmin pada database yang BARU / KOSONG.
-- Aman dijalankan ulang (IF NOT EXISTS / ON DUPLICATE KEY UPDATE).
-- Dibuat : 2026-07-10
-- =============================================================================

SET SQL_MODE   = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone  = "+07:00";
SET NAMES      utf8mb4;
SET CHARACTER SET utf8mb4;

-- =============================================================================
-- 1. TABEL: users
-- =============================================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(255)  NOT NULL,
  `email`         VARCHAR(255)  NOT NULL,
  `password_hash` VARCHAR(255)  NOT NULL,
  `role`          ENUM('super_admin','admin','viewer') NOT NULL DEFAULT 'viewer',
  `status`        ENUM('active','inactive','pending')  NOT NULL DEFAULT 'active',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. TABEL: import_batches
-- =============================================================================
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
  `column_map`      JSON          DEFAULT NULL COMMENT 'Detected {original_header: db_field_key} mapping',
  `unknown_columns` JSON          DEFAULT NULL COMMENT '{col_letter: {header, field_key_guess}}',
  `batch_status`    VARCHAR(50)   NOT NULL DEFAULT 'uploading'
                    COMMENT 'uploading|pending_validation|validated|importing|completed|discarded|failed',
  `imported_by`     INT UNSIGNED  NOT NULL,
  `imported_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_import_batches_imported_by` (`imported_by`),
  CONSTRAINT `fk_import_batches_user`
    FOREIGN KEY (`imported_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. TABEL: project_records  (skema final — semua kolom dari semua migrasi)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `project_records` (
  `id`                      INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `dataset_type`            ENUM('closing','filter900','refinement') NOT NULL DEFAULT 'closing',
  `po_year`                 VARCHAR(10)    DEFAULT NULL,
  `import_batch_id`         INT UNSIGNED   DEFAULT NULL,
  `pdid`                    VARCHAR(100)   DEFAULT NULL,
  `caid`                    VARCHAR(100)   DEFAULT NULL,
  `scarlett_ioms_id_before` VARCHAR(100)   DEFAULT NULL,
  `scarlett_ioms_id_final`  VARCHAR(100)   DEFAULT NULL,
  `status_po`               VARCHAR(100)   DEFAULT NULL,
  `pono_tsel`               VARCHAR(100)   DEFAULT NULL,
  `capex`                   DECIMAL(20,2)  DEFAULT NULL,
  `band`                    VARCHAR(50)    DEFAULT NULL,
  `sector`                  VARCHAR(50)    DEFAULT NULL,
  `project_category`        VARCHAR(100)   DEFAULT NULL,
  `sow_actual`              TEXT           DEFAULT NULL,
  `vendor_principle`        VARCHAR(100)   DEFAULT NULL,
  `cr_status`               VARCHAR(100)   DEFAULT NULL,
  `status_eba_mapping`      VARCHAR(100)   DEFAULT NULL,
  `eba_mapping_number`      VARCHAR(100)   DEFAULT NULL,
  `donor_act_siteid`        VARCHAR(100)   DEFAULT NULL,
  `donor_nop`               VARCHAR(100)   DEFAULT NULL,
  `donor_tp`                VARCHAR(100)   DEFAULT NULL,
  `donor_progress`          VARCHAR(100)   DEFAULT NULL,
  `replan_dismantle`        VARCHAR(100)   DEFAULT NULL,
  `donor_dismantle_actual`  VARCHAR(100)   DEFAULT NULL,
  `siteid_po`               VARCHAR(100)   DEFAULT NULL,
  `siteid_act`              VARCHAR(100)   DEFAULT NULL,
  `neid_act`                VARCHAR(100)   DEFAULT NULL,
  `site_name`               VARCHAR(255)   DEFAULT NULL,
  `infra_type`              VARCHAR(100)   DEFAULT NULL,
  `lat`                     DECIMAL(10,7)  DEFAULT NULL,
  `lng`                     DECIMAL(10,7)  DEFAULT NULL,
  `city`                    VARCHAR(100)   DEFAULT NULL,
  `province`                VARCHAR(100)   DEFAULT NULL,
  `nop`                     VARCHAR(100)   DEFAULT NULL,
  `tp_detail`               VARCHAR(255)   DEFAULT NULL,
  `rfs_actual`              DATE           DEFAULT NULL,
  `rfs_month`               VARCHAR(20)    DEFAULT NULL,
  `mitra_impl`              VARCHAR(100)   DEFAULT NULL,
  `progress_act`            VARCHAR(100)   DEFAULT NULL,
  `issue_category`          VARCHAR(100)   DEFAULT NULL,
  `notes_progress`          TEXT           DEFAULT NULL,
  `gap_analysis`            TEXT           DEFAULT NULL,
  `blocking`                TINYINT(1)     NOT NULL DEFAULT 0,
  `support_needed`          TEXT           DEFAULT NULL,
  `pic_blocking`            VARCHAR(255)   DEFAULT NULL,
  `detail_pic_blocking`     TEXT           DEFAULT NULL,
  `current_position`        VARCHAR(100)   DEFAULT NULL,
  `status_project`          VARCHAR(100)   DEFAULT NULL,
  `progress_closing`        VARCHAR(100)   DEFAULT NULL,
  `sub_progress_closing`    VARCHAR(100)   DEFAULT NULL,
  -- Acceptance statuses
  `atp_status`              VARCHAR(100)   DEFAULT NULL,
  `lv_status`               VARCHAR(100)   DEFAULT NULL,
  `oac_status`              VARCHAR(100)   DEFAULT NULL,
  `qc_status`               VARCHAR(100)   DEFAULT NULL,
  `sqac_status`             VARCHAR(100)   DEFAULT NULL,
  `baut_status`             VARCHAR(100)   DEFAULT NULL,
  `bast_status`             VARCHAR(100)   DEFAULT NULL,
  -- V2 additions
  `progress_done_flag`      VARCHAR(10)    DEFAULT NULL  COMMENT '1=RFS, 0=NY, x=Drop',
  `gap_closing`             TEXT           DEFAULT NULL,
  -- Financial
  `price_po`                DECIMAL(20,2)  DEFAULT NULL,
  `price_po_to_be_claim`    DECIMAL(20,2)  DEFAULT NULL,
  `price_bast`              DECIMAL(20,2)  DEFAULT NULL,
  `remaining_po`            DECIMAL(20,2)  DEFAULT NULL,
  `price_po_presales`       DECIMAL(20,2)  DEFAULT NULL,
  `wbs_level3`              VARCHAR(100)   DEFAULT NULL,
  `network_number`          VARCHAR(100)   DEFAULT NULL,
  `cid1`                    VARCHAR(100)   DEFAULT NULL,
  `cid1_price_bast`         DECIMAL(20,2)  DEFAULT NULL,
  `cid1_creation_date`      DATE           DEFAULT NULL,
  `cid1_approve_date`       DATE           DEFAULT NULL,
  `cid2`                    VARCHAR(100)   DEFAULT NULL,
  `cid2_price_bast`         DECIMAL(20,2)  DEFAULT NULL,
  `cid2_creation_date`      DATE           DEFAULT NULL,
  `cid2_approve_date`       DATE           DEFAULT NULL,
  -- Acceptance blocking notes & dates
  `atp_blocking`            TEXT           DEFAULT NULL,
  `atp_tagging_plan_ori`    DATE           DEFAULT NULL,
  `atp_tagging_replan`      DATE           DEFAULT NULL,
  `atp_tagging_done`        DATE           DEFAULT NULL,
  `atp_approved`            DATE           DEFAULT NULL,
  `lv_blocking`             TEXT           DEFAULT NULL,
  `elv_plan_ori`            DATE           DEFAULT NULL,
  `elv_replan`              DATE           DEFAULT NULL,
  `elv_approved`            DATE           DEFAULT NULL,
  `oac_blocking`            TEXT           DEFAULT NULL,
  `oac_plan_ori`            DATE           DEFAULT NULL,
  `oac_replan`              DATE           DEFAULT NULL,
  `oac_approved`            DATE           DEFAULT NULL,
  `qc_blocking`             TEXT           DEFAULT NULL,
  `qc_plan_ori`             DATE           DEFAULT NULL,
  `qc_replan`               DATE           DEFAULT NULL,
  `qc_sign`                 DATE           DEFAULT NULL,
  `sqac_blocking`           TEXT           DEFAULT NULL,
  `sqac_plan_ori`           DATE           DEFAULT NULL,
  `sqac_replan`             DATE           DEFAULT NULL,
  `sqac_approved`           DATE           DEFAULT NULL,
  `baut_blocking`           TEXT           DEFAULT NULL,
  `baut_plan_ori`           DATE           DEFAULT NULL,
  `baut_replan`             DATE           DEFAULT NULL,
  `baut_approved`           DATE           DEFAULT NULL,
  `bast_blocking`           TEXT           DEFAULT NULL,
  `bast_plan_ori`           DATE           DEFAULT NULL,
  `bast_replan`             DATE           DEFAULT NULL,
  `bast_approved`           DATE           DEFAULT NULL,
  -- Filter 900 / Refinement specific
  `remarks_sow`             TEXT           DEFAULT NULL,
  `replan_rfs`              DATE           DEFAULT NULL,
  `plan_po`                 DECIMAL(20,2)  DEFAULT NULL,
  `released_po`             DECIMAL(20,2)  DEFAULT NULL,
  -- Dynamic columns
  `custom_fields`           JSON           DEFAULT NULL,
  -- Audit
  `created_by`              INT UNSIGNED   DEFAULT NULL,
  `updated_by`              INT UNSIGNED   DEFAULT NULL,
  `deleted_at`              DATETIME       DEFAULT NULL,
  `created_at`              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_record_dataset_pdid` (`dataset_type`, `pdid`),
  KEY `idx_pr_import_batch`     (`import_batch_id`),
  KEY `idx_pr_dataset_type`     (`dataset_type`),
  KEY `idx_pr_po_year`          (`po_year`),
  KEY `idx_pr_status_project`   (`status_project`),
  KEY `idx_pr_status_po`        (`status_po`),
  KEY `idx_pr_province`         (`province`),
  KEY `idx_pr_city`             (`city`),
  KEY `idx_pr_mitra_impl`       (`mitra_impl`),
  KEY `idx_pr_project_category` (`project_category`),
  KEY `idx_pr_rfs_month`        (`rfs_month`),
  KEY `idx_pr_blocking`         (`blocking`),
  KEY `idx_pr_deleted_at`       (`deleted_at`),
  KEY `idx_pr_progress_flag`    (`progress_done_flag`),
  CONSTRAINT `fk_pr_import_batch`
    FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. TABEL: import_staging
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
-- 5. TABEL: user_chart_preferences
-- =============================================================================
CREATE TABLE IF NOT EXISTS `user_chart_preferences` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`      INT UNSIGNED NOT NULL,
  `chart_key`    VARCHAR(100) NOT NULL,
  `chart_type`   VARCHAR(50)  NOT NULL DEFAULT 'bar',
  `x_axis`       VARCHAR(100) DEFAULT NULL,
  `y_axis`       VARCHAR(100) DEFAULT NULL,
  `group_by`     VARCHAR(100) DEFAULT NULL,
  `filters_json` JSON         DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ucp_user_chart` (`user_id`, `chart_key`),
  KEY `idx_ucp_user_id` (`user_id`),
  CONSTRAINT `fk_ucp_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6. TABEL: audit_logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED    DEFAULT NULL,
  `action`      VARCHAR(100)    NOT NULL,
  `entity`      VARCHAR(100)    DEFAULT NULL,
  `entity_id`   VARCHAR(100)    DEFAULT NULL,
  `description` TEXT            DEFAULT NULL,
  `ip_address`  VARCHAR(45)     DEFAULT NULL,
  `user_agent`  VARCHAR(500)    DEFAULT NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_al_user_id`    (`user_id`),
  KEY `idx_al_action`     (`action`),
  KEY `idx_al_created_at` (`created_at`),
  CONSTRAINT `fk_al_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 7. TABEL: column_definitions
-- =============================================================================
CREATE TABLE IF NOT EXISTS `column_definitions` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `dataset_type`  VARCHAR(50)  NOT NULL DEFAULT 'all',
  `field_key`     VARCHAR(100) NOT NULL,
  `label`         VARCHAR(255) NOT NULL,
  `field_type`    ENUM('text','number','decimal','percentage','date','datetime',
                       'boolean','select','multi_select','textarea','url')
                  NOT NULL DEFAULT 'text',
  `is_system`     TINYINT(1)   NOT NULL DEFAULT 0,
  `is_visible`    TINYINT(1)   NOT NULL DEFAULT 1,
  `is_filterable` TINYINT(1)   NOT NULL DEFAULT 0,
  `is_chartable`  TINYINT(1)   NOT NULL DEFAULT 0,
  `is_required`   TINYINT(1)   NOT NULL DEFAULT 0,
  `is_archived`   TINYINT(1)   NOT NULL DEFAULT 0,
  `default_value` TEXT         DEFAULT NULL,
  `options_json`  JSON         DEFAULT NULL,
  `sort_order`    INT UNSIGNED NOT NULL DEFAULT 0,
  `column_group`  VARCHAR(100) DEFAULT NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_col_key_dataset` (`field_key`, `dataset_type`),
  INDEX `idx_col_dataset`  (`dataset_type`),
  INDEX `idx_col_visible`  (`is_visible`),
  INDEX `idx_col_archived` (`is_archived`),
  INDEX `idx_col_sort`     (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 8. TABEL: settings
-- =============================================================================
CREATE TABLE IF NOT EXISTS `settings` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key`   VARCHAR(100) NOT NULL,
  `setting_value` TEXT         DEFAULT NULL,
  `description`   VARCHAR(500) DEFAULT NULL,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SEED: Default settings
-- =============================================================================
INSERT INTO `settings` (`setting_key`, `setting_value`, `description`) VALUES
('completed_uses_flag',           '1', 'If 1: progress_done_flag=1 dihitung sebagai completed.'),
('completed_uses_rfs',            '1', 'If 1: rfs_actual terisi dihitung sebagai completed.'),
('dropped_uses_status_po',        '1', 'If 1: Status PO = Drop dihitung sebagai dropped.'),
('dropped_uses_flag_x',           '1', 'If 1: progress_done_flag = x dihitung sebagai dropped.'),
('issue_check_pic_blocking',      '1', 'If 1: pic_blocking tidak kosong dihitung sebagai issue.'),
('issue_check_acceptance_blocking','1','If 1: blocking ATP/LV/OAC/QC/SQAC/BAUT/BAST dihitung sebagai issue.'),
('issue_exclude_category',        '01. RFS', 'Nilai issue_category yang BUKAN issue (sudah RFS).')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- =============================================================================
-- SEED: Admin default
-- Email   : admin@example.com
-- Password: Admin@123456
-- GANTI PASSWORD SEGERA SETELAH LOGIN PERTAMA!
-- =============================================================================
INSERT INTO `users` (`name`, `email`, `password_hash`, `role`, `status`) VALUES
('Administrator', 'admin@example.com',
 '$2y$12$LcVXm6oHNxk5Y1bCERH0wuv1KUf5xWlV0kRPaAjB5z2UNvmPqFI.u',
 'admin', 'active')
ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `role`          = 'admin',
  `status`        = 'active';

-- =============================================================================
-- SEED: Column definitions — shared (all datasets)
-- =============================================================================
INSERT INTO `column_definitions`
  (`dataset_type`,`field_key`,`label`,`field_type`,`is_system`,`is_visible`,`is_filterable`,`is_chartable`,`is_required`,`sort_order`,`column_group`)
VALUES
('all','pdid','PDID','text',1,1,1,0,0,1,'basic'),
('all','po_year','PO Year','text',1,1,1,1,0,2,'basic'),
('all','scarlett_ioms_id_before','Scarlett / IOMS ID Before','text',1,0,0,0,0,3,'basic'),
('all','scarlett_ioms_id_final','Scarlett / IOMS ID Final','text',1,0,0,0,0,4,'basic'),
('all','status_po','Status PO','select',1,1,1,1,0,5,'basic'),
('all','pono_tsel','PoNo Tsel','text',1,1,1,0,0,6,'basic'),
('all','capex','Capex','decimal',1,0,0,0,0,7,'basic'),
('all','band','Band','select',1,1,1,1,0,8,'basic'),
('all','sector','Sector','text',1,0,1,0,0,9,'basic'),
('all','project_category','Project Category','select',1,1,1,1,0,10,'basic'),
('all','sow_actual','SOW Actual','text',1,1,1,1,0,11,'basic'),
('all','vendor_principle','Vendor Principle','select',1,1,1,1,0,12,'basic'),
('all','siteid_po','SiteID PO','text',1,0,0,0,0,13,'site'),
('all','siteid_act','SiteID Act','text',1,1,1,0,0,14,'site'),
('all','neid_act','NEID Act','text',1,0,0,0,0,15,'site'),
('all','site_name','Site Name','text',1,1,1,0,0,16,'site'),
('all','infra_type','Infra Type','select',1,0,1,1,0,17,'site'),
('all','lat','Latitude','decimal',1,0,0,0,0,18,'site'),
('all','lng','Longitude','decimal',1,0,0,0,0,19,'site'),
('all','city','City','text',1,0,1,1,0,20,'site'),
('all','province','Province','text',1,0,1,1,0,21,'site'),
('all','nop','NOP','select',1,1,1,1,0,22,'site'),
('all','tp_detail','TP Detail','text',1,1,1,1,0,23,'site'),
('all','progress_done_flag','Progress Done (FLAG)','text',1,1,1,1,0,24,'progress'),
('all','rfs_actual','RFS Actual','date',1,1,1,0,0,25,'progress'),
('all','rfs_month','RFS Month','text',1,1,1,1,0,26,'progress'),
('all','mitra_impl','Mitra Impl','select',1,1,1,1,0,27,'progress'),
('all','progress_act','Progress Act','text',1,0,0,0,0,28,'progress'),
('all','issue_category','Issue Category','text',1,1,1,1,0,29,'progress'),
('all','notes_progress','Notes Progress','textarea',1,0,0,0,0,30,'progress'),
('all','pic_blocking','PIC Blocking','text',1,1,1,1,0,31,'progress'),
('all','detail_pic_blocking','Detail PIC Blocking','textarea',1,0,0,0,0,32,'progress')
ON DUPLICATE KEY UPDATE
  `label`=VALUES(`label`), `field_type`=VALUES(`field_type`), `is_system`=1,
  `sort_order`=VALUES(`sort_order`), `column_group`=VALUES(`column_group`);

-- SEED: Column definitions — closing dataset
INSERT INTO `column_definitions`
  (`dataset_type`,`field_key`,`label`,`field_type`,`is_system`,`is_visible`,`is_filterable`,`is_chartable`,`is_required`,`sort_order`,`column_group`)
VALUES
('closing','gap_closing','Gap Closing','textarea',1,1,0,0,0,1,'progress'),
('closing','current_position','Current Position','text',1,1,1,1,0,2,'progress'),
('closing','status_project','Status Project','select',1,1,1,1,0,3,'progress'),
('closing','progress_closing','Progress Closing','text',1,1,1,1,0,4,'progress'),
('closing','sub_progress_closing','Sub Progress Closing','text',1,1,1,0,0,5,'progress'),
('closing','atp_status','ATP Status','select',1,0,1,1,0,10,'acceptance'),
('closing','atp_blocking','ATP Blocking','textarea',1,0,0,0,0,11,'acceptance'),
('closing','atp_tagging_plan_ori','Tagging Plan Ori','date',1,0,0,0,0,12,'acceptance'),
('closing','atp_tagging_replan','Tagging Re-plan','date',1,0,0,0,0,13,'acceptance'),
('closing','atp_tagging_done','Tagging Done','date',1,0,0,0,0,14,'acceptance'),
('closing','atp_approved','ATP Approved','date',1,0,0,0,0,15,'acceptance'),
('closing','lv_status','LV Status','select',1,0,1,1,0,20,'acceptance'),
('closing','lv_blocking','LV Blocking','textarea',1,0,0,0,0,21,'acceptance'),
('closing','elv_plan_ori','eLV Plan Ori','date',1,0,0,0,0,22,'acceptance'),
('closing','elv_replan','eLV Re-Plan','date',1,0,0,0,0,23,'acceptance'),
('closing','elv_approved','eLV Approved','date',1,0,0,0,0,24,'acceptance'),
('closing','oac_status','OAC Status','select',1,0,1,1,0,30,'acceptance'),
('closing','oac_blocking','OAC Blocking','textarea',1,0,0,0,0,31,'acceptance'),
('closing','oac_plan_ori','OAC Plan Ori','date',1,0,0,0,0,32,'acceptance'),
('closing','oac_replan','OAC Re-Plan','date',1,0,0,0,0,33,'acceptance'),
('closing','oac_approved','OAC Approved','date',1,0,0,0,0,34,'acceptance'),
('closing','qc_status','QC Status','select',1,0,1,1,0,40,'acceptance'),
('closing','qc_blocking','QC Blocking','textarea',1,0,0,0,0,41,'acceptance'),
('closing','qc_plan_ori','QC Plan Ori','date',1,0,0,0,0,42,'acceptance'),
('closing','qc_replan','QC Re-Plan','date',1,0,0,0,0,43,'acceptance'),
('closing','qc_sign','QC Sign','date',1,0,0,0,0,44,'acceptance'),
('closing','sqac_status','SQAC Status','select',1,0,1,1,0,50,'acceptance'),
('closing','sqac_blocking','SQAC Blocking','textarea',1,0,0,0,0,51,'acceptance'),
('closing','sqac_plan_ori','SQAC Plan Ori','date',1,0,0,0,0,52,'acceptance'),
('closing','sqac_replan','SQAC Re-Plan','date',1,0,0,0,0,53,'acceptance'),
('closing','sqac_approved','SQAC Approved','date',1,0,0,0,0,54,'acceptance'),
('closing','baut_status','BAUT Status','select',1,0,1,1,0,60,'acceptance'),
('closing','baut_blocking','BAUT Blocking','textarea',1,0,0,0,0,61,'acceptance'),
('closing','baut_plan_ori','BAUT Plan Ori','date',1,0,0,0,0,62,'acceptance'),
('closing','baut_replan','BAUT Re-Plan','date',1,0,0,0,0,63,'acceptance'),
('closing','baut_approved','BAUT Approved','date',1,0,0,0,0,64,'acceptance'),
('closing','bast_status','BAST Status','select',1,0,1,1,0,70,'acceptance'),
('closing','bast_blocking','BAST Blocking','textarea',1,0,0,0,0,71,'acceptance'),
('closing','bast_plan_ori','BAST Plan Ori','date',1,0,0,0,0,72,'acceptance'),
('closing','bast_replan','BAST Re-Plan','date',1,0,0,0,0,73,'acceptance'),
('closing','bast_approved','BAST Approved','date',1,0,0,0,0,74,'acceptance'),
('closing','price_po','Price PO','decimal',1,1,0,1,0,80,'financial'),
('closing','price_po_to_be_claim','Price PO to be Claim','decimal',1,1,0,1,0,81,'financial'),
('closing','price_bast','Price BAST (Ach)','decimal',1,1,0,1,0,82,'financial'),
('closing','remaining_po','Remaining PO','decimal',1,1,0,1,0,83,'financial'),
('closing','price_po_presales','Price PO Presales','decimal',1,0,0,0,0,84,'financial'),
('closing','wbs_level3','WBS Level3','text',1,0,0,0,0,85,'financial'),
('closing','network_number','Network Number','text',1,0,0,0,0,86,'financial'),
('closing','cid1','CID-1','text',1,0,0,0,0,87,'financial'),
('closing','cid1_price_bast','CID-1 Price BAST','decimal',1,0,0,0,0,88,'financial'),
('closing','cid1_creation_date','CID-1 Creation Date','date',1,0,0,0,0,89,'financial'),
('closing','cid1_approve_date','CID-1 Approve Date','date',1,0,0,0,0,90,'financial'),
('closing','cid2','CID-2','text',1,0,0,0,0,91,'financial'),
('closing','cid2_price_bast','CID-2 Price BAST','decimal',1,0,0,0,0,92,'financial'),
('closing','cid2_creation_date','CID-2 Creation Date','date',1,0,0,0,0,93,'financial'),
('closing','cid2_approve_date','CID-2 Approve Date','date',1,0,0,0,0,94,'financial')
ON DUPLICATE KEY UPDATE
  `label`=VALUES(`label`), `field_type`=VALUES(`field_type`), `is_system`=1,
  `sort_order`=VALUES(`sort_order`), `column_group`=VALUES(`column_group`);

-- SEED: Column definitions — filter900 dataset
INSERT INTO `column_definitions`
  (`dataset_type`,`field_key`,`label`,`field_type`,`is_system`,`is_visible`,`is_filterable`,`is_chartable`,`is_required`,`sort_order`,`column_group`)
VALUES
('filter900','remarks_sow','Remarks SOW','textarea',1,1,0,0,0,1,'filter'),
('filter900','replan_rfs','Re-Plan RFS','date',1,1,0,0,0,2,'filter'),
('filter900','plan_po','Plan PO','decimal',1,1,0,1,0,3,'filter'),
('filter900','released_po','Released PO','decimal',1,1,0,1,0,4,'filter')
ON DUPLICATE KEY UPDATE
  `label`=VALUES(`label`), `field_type`=VALUES(`field_type`), `is_system`=1,
  `sort_order`=VALUES(`sort_order`), `column_group`=VALUES(`column_group`);

-- SEED: Column definitions — refinement dataset
INSERT INTO `column_definitions`
  (`dataset_type`,`field_key`,`label`,`field_type`,`is_system`,`is_visible`,`is_filterable`,`is_chartable`,`is_required`,`sort_order`,`column_group`)
VALUES
('refinement','plan_po','Plan PO','decimal',1,1,0,1,0,1,'refinement'),
('refinement','released_po','Released PO','decimal',1,1,0,1,0,2,'refinement')
ON DUPLICATE KEY UPDATE
  `label`=VALUES(`label`), `field_type`=VALUES(`field_type`), `is_system`=1,
  `sort_order`=VALUES(`sort_order`), `column_group`=VALUES(`column_group`);

-- =============================================================================
-- SELESAI
-- Login: admin@example.com / Admin@123456
-- GANTI PASSWORD SEGERA via menu Profile setelah login pertama!
-- =============================================================================
