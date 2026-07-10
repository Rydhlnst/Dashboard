<?php
// CLI-only script. Called by dev.ps1 to initialize the local database.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden');
}

$envFile = __DIR__ . '/../../.env';
$config  = [];

if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        if (str_contains($line, '=')) {
            [$k, $v] = explode('=', $line, 2);
            $config[trim($k)] = trim($v);
        }
    }
}

$host   = $config['DB_HOST'] ?? 'localhost';
$port   = $config['DB_PORT'] ?? '3306';
$dbname = $config['DB_NAME'] ?? 'dashboard_monitoring';
$user   = $config['DB_USER'] ?? 'root';
$pass   = $config['DB_PASS'] ?? '';

// On Windows, PHP with 'localhost' tries a named pipe instead of TCP.
// Fall back to 127.0.0.1 if localhost fails.
$hosts = ($host === 'localhost') ? ['127.0.0.1', 'localhost'] : [$host];

$pdo = null;
$lastError = '';
foreach ($hosts as $h) {
    try {
        $pdo = new PDO(
            "mysql:host={$h};port={$port};charset=utf8mb4",
            $user, $pass,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        break;
    } catch (PDOException $e) {
        $lastError = $e->getMessage();
        $pdo = null;
    }
}

try {
    if ($pdo === null) {
        throw new PDOException($lastError);
    }

    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `{$dbname}`");

    $sql = file_get_contents(__DIR__ . '/migrations.sql');

    // Strip SQL comments
    $sql = preg_replace('/--[^\n]*/', '', $sql);
    $sql = preg_replace('/\/\*.*?\*\//s', '', $sql);

    foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
        $pdo->exec($stmt);
    }

    echo "Database '{$dbname}' is ready.\n";
    echo "Admin login: admin@example.com / password\n";
    exit(0);

} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    echo "Make sure MySQL is running (start Laragon or XAMPP first).\n";
    exit(1);
}
