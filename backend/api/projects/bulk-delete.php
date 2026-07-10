<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();
$body  = getRequestBody();

$ids = array_filter(array_map('intval', (array)($body['ids'] ?? [])), fn($id) => $id > 0);

if (empty($ids)) {
    jsonError('ids array with valid IDs is required.', 422);
}
if (count($ids) > 500) {
    jsonError('Cannot bulk-delete more than 500 records at once.', 422);
}

$db = getDB();
$placeholders = implode(',', array_fill(0, count($ids), '?'));

$stmt = $db->prepare("UPDATE project_records SET deleted_at = NOW(), updated_by = ? WHERE id IN ({$placeholders}) AND deleted_at IS NULL");
$stmt->execute(array_merge([$admin['id']], array_values($ids)));
$deleted = $stmt->rowCount();

AuditLog::log($admin['id'], 'bulk_delete', 'project_records', null,
    "Soft-deleted {$deleted} records. IDs: " . implode(',', $ids));

jsonSuccess(['deleted' => $deleted], "{$deleted} records deleted.");
