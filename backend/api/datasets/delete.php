<?php
/**
 * DELETE /api/datasets/delete.php?id=1
 *
 * Drops the ds_* table and removes the registry entry.
 * Also cleans up related import_batches and import_staging rows.
 *
 * Requires super_admin role.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/schema_builder.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();
if ($admin['role'] !== 'super_admin') {
    jsonError('Only super_admin can delete datasets.', 403);
}

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) jsonError('id is required.', 400);

try {
    $db   = getDB();
    $stmt = $db->prepare("SELECT * FROM datasets WHERE id=? LIMIT 1");
    $stmt->execute([$id]);
    $dataset = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$dataset) jsonError("Dataset #{$id} not found.", 404);

    $tableName = $dataset['table_name'];

    // Verify the table name is a safe ds_* table before DROP
    if (!preg_match('/^ds_[a-z0-9_]+$/', $tableName)) {
        jsonError("Unsafe table name '{$tableName}' — aborting.", 500);
    }

    $db->beginTransaction();

    // Clean up staging rows linked to batches of this dataset
    $db->prepare(
        "DELETE s FROM import_staging s
          INNER JOIN import_batches b ON b.id = s.batch_id
          WHERE b.dataset_id = ?"
    )->execute([$id]);

    // Clean up import batches
    $db->prepare("DELETE FROM import_batches WHERE dataset_id=?")->execute([$id]);

    // Remove from registry
    $db->prepare("DELETE FROM datasets WHERE id=?")->execute([$id]);

    // Drop the dynamic table
    $db->exec("DROP TABLE IF EXISTS `{$tableName}`");

    $db->commit();

    AuditLog::log(
        $admin['id'], 'delete_dataset', 'dataset', (string)$id,
        "Deleted dataset '{$dataset['name']}' and dropped table {$tableName}"
    );

    jsonSuccess(['deleted_id' => $id, 'table_name' => $tableName],
        "Dataset '{$dataset['name']}' deleted.");

} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    jsonError('Delete failed: ' . $e->getMessage(), 500);
}
