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

$body = getRequestBody();

// Validate required fields
$errors = validateRequired($body, ['name', 'email', 'password']);
if (!empty($errors)) {
    jsonError('Validation failed.', 422, $errors);
}

$name     = sanitizeString($body['name'] ?? '');
$email    = sanitizeEmail($body['email'] ?? '');
$password = $body['password'] ?? '';

if (!$email) {
    jsonError('Invalid email address.', 422);
}
if (strlen($name) < 2 || strlen($name) > 255) {
    jsonError('Name must be between 2 and 255 characters.', 422);
}
if (strlen($password) < 8) {
    jsonError('Password must be at least 8 characters.', 422);
}

$db = getDB();

// Check duplicate email
$stmt = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonError('Email already registered.', 409);
}

$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$stmt = $db->prepare(
    'INSERT INTO users (name, email, password_hash, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())'
);
$stmt->execute([$name, $email, $hash, 'viewer', 'pending']);
$newId = (int)$db->lastInsertId();

AuditLog::log($newId, 'signup', 'user', (string)$newId, "User registered (pending approval): {$email}");

jsonSuccess(
    ['id' => $newId, 'email' => $email, 'role' => 'viewer', 'status' => 'pending'],
    'Registration successful. Your account is pending admin approval before you can log in.',
    201
);
