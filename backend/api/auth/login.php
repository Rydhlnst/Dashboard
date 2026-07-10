<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

// Start session before output
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => isset($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

$body = getRequestBody();
$errors = validateRequired($body, ['email', 'password']);
if (!empty($errors)) {
    jsonError('Validation failed.', 422, $errors);
}

$email    = sanitizeEmail($body['email'] ?? '');
$password = $body['password'] ?? '';

if (!$email) {
    jsonError('Invalid email address.', 422);
}

$db   = getDB();
$stmt = $db->prepare('SELECT id, name, email, password_hash, role, status FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    // Generic error to avoid user enumeration
    AuditLog::log(null, 'login_failed', 'user', '', "Failed login attempt for: {$email}");
    jsonError('Invalid email or password.', 401);
}

if ($user['status'] === 'pending') {
    jsonError('Your account is pending admin approval. Please wait for an admin to activate your account.', 403);
}

if ($user['status'] !== 'active') {
    jsonError('Your account has been deactivated.', 403);
}

// Regenerate session ID to prevent fixation
session_regenerate_id(true);
$_SESSION['user_id'] = $user['id'];
$_SESSION['role']    = $user['role'];

AuditLog::log($user['id'], 'login', 'user', (string)$user['id'], "User logged in: {$email}");

$responseData = [
    'id'    => $user['id'],
    'name'  => $user['name'],
    'email' => $user['email'],
    'role'  => $user['role'],
];

jsonSuccess($responseData, 'Login successful.');
