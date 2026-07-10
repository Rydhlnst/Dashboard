<?php
/**
 * Utility: Generate bcrypt hash untuk password admin
 * Jalankan dari CLI: php tools/generate-password.php
 * Atau akses via browser sekali, lalu hapus file ini!
 */

if (PHP_SAPI !== 'cli') {
    header('Content-Type: text/plain');
}

$password = $argv[1] ?? 'Admin@123456';
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

echo "Password : {$password}\n";
echo "Hash     : {$hash}\n\n";
echo "UPDATE users SET password_hash = '{$hash}' WHERE email = 'admin@example.com';\n";
