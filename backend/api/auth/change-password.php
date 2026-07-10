<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$user = requireAuth();
$body = getRequestBody();

$errors = validateRequired($body, ['current_password', 'new_password']);
if (!empty($errors)) {
    jsonError('Validation failed.', 422, $errors);
}

$currentPassword = $body['current_password'] ?? '';
$newPassword     = $body['new_password'] ?? '';

if (strlen($newPassword) < 8) {
    jsonError('New password must be at least 8 characters.', 422);
}

$db   = getDB();
$stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$user['id']]);
$row  = $stmt->fetch();

if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
    jsonError('Current password is incorrect.', 403);
}

$newHash = password_hash($newPassword, PASSWORD_BCRYPT);
$upd     = $db->prepare('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?');
$upd->execute([$newHash, $user['id']]);

AuditLog::log($user['id'], 'change_password', 'user', (string)$user['id'], 'User changed own password.');

jsonSuccess([], 'Password changed successfully.');
