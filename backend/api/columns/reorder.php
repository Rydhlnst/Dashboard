<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();
$body  = getRequestBody();

// Expect: { "order": [{"id": 1, "sort_order": 10}, ...] }
if (empty($body['order']) || !is_array($body['order'])) {
    jsonError('order array is required.', 422);
}

$db = getDB();
$stmt = $db->prepare("UPDATE column_definitions SET sort_order = ?, updated_at = NOW() WHERE id = ?");

$db->beginTransaction();
try {
    foreach ($body['order'] as $item) {
        $colId = (int)($item['id'] ?? 0);
        $order = (int)($item['sort_order'] ?? 0);
        if ($colId > 0) {
            $stmt->execute([$order, $colId]);
        }
    }
    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    jsonError('Reorder failed: ' . $e->getMessage(), 500);
}

AuditLog::log($admin['id'], 'reorder_columns', 'column_definition', null, 'Reordered ' . count($body['order']) . ' columns');

jsonSuccess(null, 'Column order updated.');
