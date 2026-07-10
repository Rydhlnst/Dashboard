-- ============================================================
-- Seed Admin User
-- Email: admin@example.com
-- Password: Admin@123456
-- ============================================================
-- This hash is for 'Admin@123456' with cost 12
-- Generate new hash with PHP: echo password_hash('Admin@123456', PASSWORD_BCRYPT, ['cost' => 12]);

INSERT INTO `users` (`name`, `email`, `password_hash`, `role`, `status`) VALUES
('Administrator', 'admin@example.com', '$2y$12$LcVXm6oHNxk5Y1bCERH0wuv1KUf5xWlV0kRPaAjB5z2UNvmPqFI.u', 'admin', 'active')
ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `role` = 'admin',
  `status` = 'active';
