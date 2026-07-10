<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();
$body  = getRequestBody();

$targetId = sanitizeInt($body['user_id'] ?? null);
$role     = strtolower(sanitizeString($body['role'] ?? '') ?? '');

if (!$targetId) {
    jsonError('Missing user_id.', 400);
}
if (!in_array($role, ['super_admin', 'admin', 'viewer'], true)) {
    jsonError('Invalid role. Must be super_admin, admin, or viewer.', 422);
}
// Prevent self-demotion
if ($targetId === $admin['id'] && !in_array($role, ['super_admin','admin'], true)) {
    jsonError('Cannot change your own role.', 403);
}

$db   = getDB();
$stmt = $db->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$targetId]);
if (!$stmt->fetch()) {
    jsonError('User not found.', 404);
}

$stmt = $db->prepare('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?');
$stmt->execute([$role, $targetId]);

AuditLog::log($admin['id'], 'update_role', 'user', (string)$targetId, "Changed user {$targetId} role to {$role}");

jsonSuccess(['user_id' => $targetId, 'role' => $role], 'User role updated.');
