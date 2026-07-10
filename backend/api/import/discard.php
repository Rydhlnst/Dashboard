<?php
/**
 * DELETE /api/import/discard.php
 *
 * Body: { batch_id: int }
 *
 * Removes all staging rows and marks the batch as discarded.
 * Does NOT touch project_records — only the pre-import staging data.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonError('Method not allowed.', 405);
}

$admin   = requireAdmin();
$body    = getRequestBody();
$batchId = (int)($body['batch_id'] ?? 0);

if ($batchId <= 0) jsonError('batch_id is required.', 400);

try {
    $db = getDB();

    $stmt = $db->prepare("SELECT id, batch_status FROM import_batches WHERE id=? LIMIT 1");
    $stmt->execute([$batchId]);
    $batch = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$batch) jsonError("Batch #{$batchId} not found.", 404);
    if ($batch['batch_status'] === 'completed') {
        jsonError('Cannot discard a completed import batch.', 409);
    }

    $db->prepare("DELETE FROM import_staging WHERE batch_id=?")->execute([$batchId]);
    $db->prepare("UPDATE import_batches SET batch_status='discarded' WHERE id=?")->execute([$batchId]);

    AuditLog::log($admin['id'], 'discard_import', 'import_batch', (string)$batchId,
        "Discarded import batch #{$batchId}");

    jsonSuccess(['batch_id' => $batchId], "Batch #{$batchId} discarded.");

} catch (Throwable $e) {
    jsonError('Discard failed: ' . $e->getMessage(), 500);
}
