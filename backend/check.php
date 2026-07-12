<?php
// Minimal diagnostic - PHP 5.6+ compatible
error_reporting(E_ALL);
ini_set('display_errors', 1);
echo "<pre>";
echo "PHP Version: " . PHP_VERSION . "\n";
echo "Server: " . (isset($_SERVER['SERVER_SOFTWARE']) ? $_SERVER['SERVER_SOFTWARE'] : '-') . "\n";
echo "Dir: " . __DIR__ . "\n";
echo "\n--- .env check ---\n";
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    echo ".env FOUND\n";
    echo file_get_contents($envFile);
} else {
    echo ".env NOT FOUND at: " . $envFile . "\n";
    // coba satu level di atas
    $envFile2 = __DIR__ . '/../.env';
    if (file_exists($envFile2)) {
        echo ".env found at parent: " . $envFile2 . "\n";
    } else {
        echo ".env also not at parent\n";
    }
}
echo "\n--- Extensions ---\n";
echo "pdo: "       . (extension_loaded('pdo')       ? 'YES' : 'NO') . "\n";
echo "pdo_mysql: " . (extension_loaded('pdo_mysql') ? 'YES' : 'NO') . "\n";
echo "json: "      . (extension_loaded('json')      ? 'YES' : 'NO') . "\n";
echo "mbstring: "  . (extension_loaded('mbstring')  ? 'YES' : 'NO') . "\n";
echo "\n--- Folder check ---\n";
echo "uploads exists: "      . (is_dir(__DIR__ . '/uploads')       ? 'YES' : 'NO') . "\n";
echo "uploads writable: "    . (is_writable(__DIR__ . '/uploads')  ? 'YES' : 'NO') . "\n";
echo "api folder exists: "   . (is_dir(__DIR__ . '/api')           ? 'YES' : 'NO') . "\n";
echo "vendor exists: "       . (file_exists(__DIR__ . '/vendor/autoload.php') ? 'YES' : 'NO') . "\n";
echo "\n--- DB Test ---\n";
// Hardcode untuk test cepat
$host = 'localhost';
$name = 'rizkyynw_admin';
$user = 'rizkyynw_admin';
$pass = 'rizkynwwpassword123A!';
try {
    $pdo = new PDO("mysql:host=$host;dbname=$name;charset=utf8mb4", $user, $pass);
    echo "DB Connection: OK\n";
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables: " . implode(', ', $tables) . "\n";
} catch (Exception $e) {
    echo "DB Connection FAILED: " . $e->getMessage() . "\n";
}
echo "\nDONE";
echo "</pre>";
