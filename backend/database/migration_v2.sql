-- ============================================================
-- Dashboard Monitoring - Migration V2
-- Run this AFTER migrations.sql
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+07:00";

-- ============================================================
-- Extend project_records
-- ============================================================

-- Dataset type
ALTER TABLE `project_records`
  ADD COLUMN `dataset_type` ENUM('closing','filter900','refinement') NOT NULL DEFAULT 'closing' AFTER `id`;

-- Core missing fields
ALTER TABLE `project_records`
  ADD COLUMN `po_year` VARCHAR(10) DEFAULT NULL AFTER `dataset_type`,
  ADD COLUMN `scarlett_ioms_id_before` VARCHAR(100) DEFAULT NULL AFTER `caid`,
  ADD COLUMN `progress_done_flag` VARCHAR(10) DEFAULT NULL COMMENT '1=RFS, 0=NY, x=Drop',
  ADD COLUMN `gap_closing` TEXT DEFAULT NULL,
  ADD COLUMN `deleted_at` DATETIME DEFAULT NULL,
  ADD COLUMN `created_by` INT UNSIGNED DEFAULT NULL,
  ADD COLUMN `updated_by` INT UNSIGNED DEFAULT NULL;

-- Financial columns
ALTER TABLE `project_records`
  ADD COLUMN `price_po` DECIMAL(20,2) DEFAULT NULL,
  ADD COLUMN `price_po_to_be_claim` DECIMAL(20,2) DEFAULT NULL,
  ADD COLUMN `price_bast` DECIMAL(20,2) DEFAULT NULL,
  ADD COLUMN `remaining_po` DECIMAL(20,2) DEFAULT NULL,
  ADD COLUMN `price_po_presales` DECIMAL(20,2) DEFAULT NULL,
  ADD COLUMN `wbs_level3` VARCHAR(100) DEFAULT NULL,
  ADD COLUMN `network_number` VARCHAR(100) DEFAULT NULL,
  ADD COLUMN `cid1` VARCHAR(100) DEFAULT NULL,
  ADD COLUMN `cid1_price_bast` DECIMAL(20,2) DEFAULT NULL,
  ADD COLUMN `cid1_creation_date` DATE DEFAULT NULL,
  ADD COLUMN `cid1_approve_date` DATE DEFAULT NULL,
  ADD COLUMN `cid2` VARCHAR(100) DEFAULT NULL,
  ADD COLUMN `cid2_price_bast` DECIMAL(20,2) DEFAULT NULL,
  ADD COLUMN `cid2_creation_date` DATE DEFAULT NULL,
  ADD COLUMN `cid2_approve_date` DATE DEFAULT NULL;

-- Acceptance blocking & date columns
ALTER TABLE `project_records`
  ADD COLUMN `atp_blocking` TEXT DEFAULT NULL,
  ADD COLUMN `atp_tagging_plan_ori` DATE DEFAULT NULL,
  ADD COLUMN `atp_tagging_replan` DATE DEFAULT NULL,
  ADD COLUMN `atp_tagging_done` DATE DEFAULT NULL,
  ADD COLUMN `atp_approved` DATE DEFAULT NULL,
  ADD COLUMN `lv_blocking` TEXT DEFAULT NULL,
  ADD COLUMN `elv_plan_ori` DATE DEFAULT NULL,
  ADD COLUMN `elv_replan` DATE DEFAULT NULL,
  ADD COLUMN `elv_approved` DATE DEFAULT NULL,
  ADD COLUMN `oac_blocking` TEXT DEFAULT NULL,
  ADD COLUMN `oac_plan_ori` DATE DEFAULT NULL,
  ADD COLUMN `oac_replan` DATE DEFAULT NULL,
  ADD COLUMN `oac_approved` DATE DEFAULT NULL,
  ADD COLUMN `qc_blocking` TEXT DEFAULT NULL,
  ADD COLUMN `qc_plan_ori` DATE DEFAULT NULL,
  ADD COLUMN `qc_replan` DATE DEFAULT NULL,
  ADD COLUMN `qc_sign` DATE DEFAULT NULL,
  ADD COLUMN `sqac_blocking` TEXT DEFAULT NULL,
  ADD COLUMN `sqac_plan_ori` DATE DEFAULT NULL,
  ADD COLUMN `sqac_replan` DATE DEFAULT NULL,
  ADD COLUMN `sqac_approved` DATE DEFAULT NULL,
  ADD COLUMN `baut_blocking` TEXT DEFAULT NULL,
  ADD COLUMN `baut_plan_ori` DATE DEFAULT NULL,
  ADD COLUMN `baut_replan` DATE DEFAULT NULL,
  ADD COLUMN `baut_approved` DATE DEFAULT NULL,
  ADD COLUMN `bast_blocking` TEXT DEFAULT NULL,
  ADD COLUMN `bast_plan_ori` DATE DEFAULT NULL,
  ADD COLUMN `bast_replan` DATE DEFAULT NULL,
  ADD COLUMN `bast_approved` DATE DEFAULT NULL;

-- Filter 900 & Refinement specific
ALTER TABLE `project_records`
  ADD COLUMN `remarks_sow` TEXT DEFAULT NULL,
  ADD COLUMN `replan_rfs` DATE DEFAULT NULL,
  ADD COLUMN `plan_po` DECIMAL(20,2) DEFAULT NULL,
  ADD COLUMN `released_po` DECIMAL(20,2) DEFAULT NULL;

-- Custom fields JSON for dynamic columns
ALTER TABLE `project_records`
  ADD COLUMN `custom_fields` JSON DEFAULT NULL;

-- Indexes
ALTER TABLE `project_records`
  ADD INDEX `idx_pr_dataset_type` (`dataset_type`),
  ADD INDEX `idx_pr_po_year` (`po_year`),
  ADD INDEX `idx_pr_deleted_at` (`deleted_at`),
  ADD INDEX `idx_pr_progress_flag` (`progress_done_flag`);

-- ============================================================
-- Extend users — add super_admin role
-- ============================================================
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('super_admin','admin','viewer') NOT NULL DEFAULT 'viewer';

-- ============================================================
-- Extend import_batches — add dataset_type
-- ============================================================
ALTER TABLE `import_batches`
  ADD COLUMN `dataset_type` VARCHAR(50) NOT NULL DEFAULT 'closing' AFTER `file_name`;

-- ============================================================
-- New table: column_definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS `column_definitions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `dataset_type` VARCHAR(50) NOT NULL DEFAULT 'all',
  `field_key` VARCHAR(100) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `field_type` ENUM('text','number','decimal','percentage','date','datetime','boolean','select','multi_select','textarea','url') NOT NULL DEFAULT 'text',
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `is_filterable` TINYINT(1) NOT NULL DEFAULT 0,
  `is_chartable` TINYINT(1) NOT NULL DEFAULT 0,
  `is_required` TINYINT(1) NOT NULL DEFAULT 0,
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  `default_value` TEXT DEFAULT NULL,
  `options_json` JSON DEFAULT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `column_group` VARCHAR(100) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_col_key_dataset` (`field_key`, `dataset_type`),
  INDEX `idx_col_dataset` (`dataset_type`),
  INDEX `idx_col_visible` (`is_visible`),
  INDEX `idx_col_archived` (`is_archived`),
  INDEX `idx_col_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- New table: settings
-- ============================================================
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` TEXT DEFAULT NULL,
  `description` VARCHAR(500) DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default settings
INSERT INTO `settings` (`setting_key`, `setting_value`, `description`) VALUES
('completed_uses_flag', '1', 'If 1: use progress_done_flag=1 as completed. If 0: only use rfs_actual.'),
('completed_uses_rfs', '1', 'If 1: use rfs_actual date as completed indicator.'),
('dropped_uses_status_po', '1', 'If 1: Status PO = Drop means dropped.'),
('dropped_uses_flag_x', '1', 'If 1: progress_done_flag = x means dropped.'),
('issue_check_pic_blocking', '1', 'If 1: non-empty pic_blocking counts as issue.'),
('issue_check_acceptance_blocking', '1', 'If 1: ATP/LV/OAC/QC/SQAC/BAUT/BAST blocking fields count as issue.'),
('issue_exclude_category', '01. RFS', 'Issue category value that means no issue (already RFS).')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
