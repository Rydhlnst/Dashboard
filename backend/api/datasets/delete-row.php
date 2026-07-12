<?php
/**
 * POST /api/datasets/delete-row.php
 *
 * Delete a single row from a dynamic ds_* table.
 *
 * JSON body:
 *   dataset_id : int  required
 *   row_id     : int  required
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

requireAdmin();

$body      = getRequestBody();
$datasetId = (int)($body['dataset_id'] ?? 0);
$rowId     = (int)($body['row_id']     ?? 0);

if ($datasetId <= 0) jsonError('dataset_id is required.', 400);
if ($rowId     <= 0) jsonError('row_id is required.', 400);

try {
    $db = getDB();

    $dStmt = $db->prepare("SELECT table_name FROM datasets WHERE id=? LIMIT 1");
    $dStmt->execute([$datasetId]);
    $dataset = $dStmt->fetch(PDO::FETCH_ASSOC);
    if (!$dataset) jsonError("Dataset #{$datasetId} not found.", 404);

    $tableName = $dataset['table_name'];
    if (!preg_match('/^ds_[a-z0-9_]+$/', $tableName)) {
        jsonError("Unsafe table name '{$tableName}'.", 500);
    }

    $stmt = $db->prepare("DELETE FROM `{$tableName}` WHERE `_id` = ?");
    $stmt->execute([$rowId]);

    if ($stmt->rowCount() === 0) jsonError('Row not found.', 404);

    // Keep row_count in sync
    try {
        $db->prepare("UPDATE datasets SET row_count = GREATEST(row_count - 1, 0), updated_at = NOW() WHERE id = ?")
           ->execute([$datasetId]);
    } catch (Throwable $inner) { /* ignore */ }

    jsonSuccess(['deleted_id' => $rowId], 'Row deleted.');

} catch (Throwable $e) {
    jsonError('Delete failed: ' . $e->getMessage(), 500);
}
