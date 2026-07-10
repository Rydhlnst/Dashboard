-- ============================================================
-- Dashboard Monitoring Data - Database Migrations
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+07:00";

-- Create database (uncomment if needed)
-- CREATE DATABASE IF NOT EXISTS `dashboard_monitoring` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE `dashboard_monitoring`;

-- ============================================================
-- Table: users
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin','viewer') NOT NULL DEFAULT 'viewer',
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: import_batches
-- ============================================================
CREATE TABLE IF NOT EXISTS `import_batches` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `file_name` VARCHAR(255) NOT NULL,
  `total_rows` INT UNSIGNED NOT NULL DEFAULT 0,
  `success_rows` INT UNSIGNED NOT NULL DEFAULT 0,
  `failed_rows` INT UNSIGNED NOT NULL DEFAULT 0,
  `imported_by` INT UNSIGNED NOT NULL,
  `imported_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_import_batches_imported_by` (`imported_by`),
  CONSTRAINT `fk_import_batches_user` FOREIGN KEY (`imported_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: project_records
-- ============================================================
CREATE TABLE IF NOT EXISTS `project_records` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `import_batch_id` INT UNSIGNED DEFAULT NULL,
  `pdid` VARCHAR(100) DEFAULT NULL,
  `caid` VARCHAR(100) DEFAULT NULL,
  `scarlett_ioms_id_final` VARCHAR(100) DEFAULT NULL,
  `status_po` VARCHAR(100) DEFAULT NULL,
  `pono_tsel` VARCHAR(100) DEFAULT NULL,
  `capex` DECIMAL(20,2) DEFAULT NULL,
  `band` VARCHAR(50) DEFAULT NULL,
  `sector` VARCHAR(50) DEFAULT NULL,
  `project_category` VARCHAR(100) DEFAULT NULL,
  `sow_actual` TEXT DEFAULT NULL,
  `vendor_principle` VARCHAR(100) DEFAULT NULL,
  `cr_status` VARCHAR(100) DEFAULT NULL,
  `status_eba_mapping` VARCHAR(100) DEFAULT NULL,
  `eba_mapping_number` VARCHAR(100) DEFAULT NULL,
  `donor_act_siteid` VARCHAR(100) DEFAULT NULL,
  `donor_nop` VARCHAR(100) DEFAULT NULL,
  `donor_tp` VARCHAR(100) DEFAULT NULL,
  `donor_progress` VARCHAR(100) DEFAULT NULL,
  `replan_dismantle` VARCHAR(100) DEFAULT NULL,
  `donor_dismantle_actual` VARCHAR(100) DEFAULT NULL,
  `siteid_po` VARCHAR(100) DEFAULT NULL,
  `siteid_act` VARCHAR(100) DEFAULT NULL,
  `neid_act` VARCHAR(100) DEFAULT NULL,
  `site_name` VARCHAR(255) DEFAULT NULL,
  `infra_type` VARCHAR(100) DEFAULT NULL,
  `lat` DECIMAL(10,7) DEFAULT NULL,
  `lng` DECIMAL(10,7) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `province` VARCHAR(100) DEFAULT NULL,
  `nop` VARCHAR(100) DEFAULT NULL,
  `tp_detail` VARCHAR(255) DEFAULT NULL,
  `rfs_actual` DATE DEFAULT NULL,
  `rfs_month` VARCHAR(20) DEFAULT NULL,
  `mitra_impl` VARCHAR(100) DEFAULT NULL,
  `progress_act` VARCHAR(100) DEFAULT NULL,
  `issue_category` VARCHAR(100) DEFAULT NULL,
  `notes_progress` TEXT DEFAULT NULL,
  `gap_analysis` TEXT DEFAULT NULL,
  `blocking` TINYINT(1) NOT NULL DEFAULT 0,
  `support_needed` TEXT DEFAULT NULL,
  `pic_blocking` VARCHAR(255) DEFAULT NULL,
  `detail_pic_blocking` TEXT DEFAULT NULL,
  `current_position` VARCHAR(100) DEFAULT NULL,
  `status_project` VARCHAR(100) DEFAULT NULL,
  `progress_closing` VARCHAR(100) DEFAULT NULL,
  `sub_progress_closing` VARCHAR(100) DEFAULT NULL,
  `atp_status` VARCHAR(100) DEFAULT NULL,
  `lv_status` VARCHAR(100) DEFAULT NULL,
  `oac_status` VARCHAR(100) DEFAULT NULL,
  `qc_status` VARCHAR(100) DEFAULT NULL,
  `sqac_status` VARCHAR(100) DEFAULT NULL,
  `baut_status` VARCHAR(100) DEFAULT NULL,
  `bast_status` VARCHAR(100) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pr_import_batch` (`import_batch_id`),
  KEY `idx_pr_status_project` (`status_project`),
  KEY `idx_pr_status_po` (`status_po`),
  KEY `idx_pr_province` (`province`),
  KEY `idx_pr_city` (`city`),
  KEY `idx_pr_mitra_impl` (`mitra_impl`),
  KEY `idx_pr_project_category` (`project_category`),
  KEY `idx_pr_rfs_month` (`rfs_month`),
  KEY `idx_pr_blocking` (`blocking`),
  CONSTRAINT `fk_pr_import_batch` FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: user_chart_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_chart_preferences` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `chart_key` VARCHAR(100) NOT NULL,
  `chart_type` VARCHAR(50) NOT NULL DEFAULT 'bar',
  `x_axis` VARCHAR(100) DEFAULT NULL,
  `y_axis` VARCHAR(100) DEFAULT NULL,
  `group_by` VARCHAR(100) DEFAULT NULL,
  `filters_json` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ucp_user_chart` (`user_id`, `chart_key`),
  KEY `idx_ucp_user_id` (`user_id`),
  CONSTRAINT `fk_ucp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity` VARCHAR(100) DEFAULT NULL,
  `entity_id` VARCHAR(100) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_al_user_id` (`user_id`),
  KEY `idx_al_action` (`action`),
  KEY `idx_al_created_at` (`created_at`),
  CONSTRAINT `fk_al_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Seed: Default Admin User
-- Password: Admin@123456
-- ============================================================
INSERT INTO `users` (`name`, `email`, `password_hash`, `role`, `status`) VALUES
('Administrator', 'admin@example.com', '$2y$12$4X3b/WVK/QgiSADHlYDWkuSuIDDoanNT/4ZrJlasSTcRGCbxf0ChK', 'admin', 'active')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
-- Note: password above is 'Admin@123456' for testing. Change it after first login!
-- To generate your own: password_hash('YourPassword', PASSWORD_BCRYPT, ['cost' => 12])
