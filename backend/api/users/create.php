<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();
$body  = getRequestBody();

$errors = validateRequired($body, ['name', 'email', 'password', 'role']);
if (!empty($errors)) {
    jsonError('Validation failed.', 422, $errors);
}

$name     = sanitizeString($body['name'] ?? '');
$email    = strtolower(trim($body['email'] ?? ''));
$password = $body['password'] ?? '';
$role     = $body['role'] ?? 'viewer';
$status   = $body['status'] ?? 'active';

$allowedRoles = ['viewer', 'admin'];
if ($admin['role'] === 'super_admin') $allowedRoles[] = 'super_admin';
if (!in_array($role, $allowedRoles, true)) {
    jsonError('Invalid role.', 422);
}

if (!in_array($status, ['active', 'inactive', 'pending'], true)) {
    jsonError('Invalid status.', 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonError('Invalid email address.', 422);
}

if (strlen($password) < 8) {
    jsonError('Password must be at least 8 characters.', 422);
}

$db = getDB();

$check = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$check->execute([$email]);
if ($check->fetch()) {
    jsonError('Email is already registered.', 409);
}

$hash = password_hash($password, PASSWORD_BCRYPT);
$ins  = $db->prepare(
    'INSERT INTO users (name, email, password_hash, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())'
);
$ins->execute([$name, $email, $hash, $role, $status]);

$newId = (int)$db->lastInsertId();
AuditLog::log($admin['id'], 'create_user', 'user', (string)$newId, "Admin created user {$email} with role {$role}.");

jsonSuccess(['id' => $newId, 'email' => $email, 'role' => $role], 'User created successfully.', 201);
