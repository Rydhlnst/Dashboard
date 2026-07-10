<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();

$id = (int)($_GET['id'] ?? 0);
if ($id < 1) {
    jsonError('Column ID required.', 400);
}

$db = getDB();
$stmt = $db->prepare("SELECT * FROM column_definitions WHERE id = ?");
$stmt->execute([$id]);
$col = $stmt->fetch();

if (!$col) {
    jsonError('Column not found.', 404);
}
if ((bool)$col['is_system']) {
    jsonError('System columns cannot be archived.', 403);
}

$body = getRequestBody();
$archive = isset($body['archive']) ? (bool)$body['archive'] : true;

$db->prepare("UPDATE column_definitions SET is_archived = ?, updated_at = NOW() WHERE id = ?")
   ->execute([$archive ? 1 : 0, $id]);

$action = $archive ? 'archive_column' : 'restore_column';
AuditLog::log($admin['id'], $action, 'column_definition', (string)$id,
    ($archive ? 'Archived' : 'Restored') . " column '{$col['field_key']}'");

jsonSuccess(['id' => $id, 'archived' => $archive], $archive ? 'Column archived.' : 'Column restored.');
