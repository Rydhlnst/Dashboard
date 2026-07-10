<?php
// ── Load .env ───────────────────────────────────────────────────────────────
$envFile = __DIR__ . '/../../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value);
        }
    }
}

// ── Allowed origins ─────────────────────────────────────────────────────────
$allowedOrigins = array_filter(
    array_map('trim', explode(',', $_ENV['FRONTEND_URL'] ?? 'http://localhost:3000'))
);

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} elseif (!empty($allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . reset($allowedOrigins));
}

header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');

// ── Session cookie — cross-origin safe (Vercel HTTPS → cPanel) ─────────────
// SameSite=None + Secure lets cookies be sent from Vercel (https) to the API.
$isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
          || (($_SERVER['SERVER_PORT'] ?? 80) == 443);

session_set_cookie_params([
    'lifetime' => 86400 * 7,   // 7 days
    'path'     => '/',
    'domain'   => '',
    'secure'   => $isSecure,   // true on HTTPS (production), false on localhost
    'httponly' => true,
    'samesite' => $isSecure ? 'None' : 'Lax', // None only works over HTTPS
]);

// ── Preflight exit ──────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
