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

$admin  = requireAdmin();
$body   = getRequestBody();

$targetId = sanitizeInt($body['user_id'] ?? null);
$status   = strtolower(sanitizeString($body['status'] ?? '') ?? '');

if (!$targetId) {
    jsonError('Missing user_id.', 400);
}
if (!in_array($status, ['active', 'inactive', 'pending'], true)) {
    jsonError('Invalid status. Must be active, inactive, or pending.', 422);
}
if ($targetId === $admin['id']) {
    jsonError('Cannot change your own status.', 403);
}

$db   = getDB();
$stmt = $db->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$targetId]);
if (!$stmt->fetch()) {
    jsonError('User not found.', 404);
}

$stmt = $db->prepare('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?');
$stmt->execute([$status, $targetId]);

AuditLog::log($admin['id'], 'update_status', 'user', (string)$targetId, "Changed user {$targetId} status to {$status}");

jsonSuccess(['user_id' => $targetId, 'status' => $status], 'User status updated.');
