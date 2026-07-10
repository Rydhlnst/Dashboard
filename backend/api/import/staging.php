<?php
/**
 * GET /api/import/staging.php
 *
 * Returns paginated staging rows for a batch so the UI can show
 * per-row validation results.
 *
 * Query params:
 *   batch_id  int     required
 *   status    string  optional: valid | warning | error | imported | all (default: all)
 *   page      int     default 1
 *   limit     int     default 50 (max 200)
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed.', 405);
}

requireAdmin();

$batchId = (int)($_GET['batch_id'] ?? 0);
if ($batchId <= 0) jsonError('batch_id is required.', 400);

$statusFilter = $_GET['status'] ?? 'all';
$page  = max(1, (int)($_GET['page']  ?? 1));
$limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));
$offset = ($page - 1) * $limit;

$allowed = ['valid','warning','error','imported','pending','all'];
if (!in_array($statusFilter, $allowed, true)) $statusFilter = 'all';

try {
    $db = getDB();

    // Verify batch exists
    $bStmt = $db->prepare("SELECT id, dataset_type, batch_status, total_rows, valid_rows, warning_rows, error_rows FROM import_batches WHERE id=?");
    $bStmt->execute([$batchId]);
    $batchMeta = $bStmt->fetch(PDO::FETCH_ASSOC);
    if (!$batchMeta) jsonError("Batch #{$batchId} not found.", 404);

    $where  = 'batch_id = ?';
    $params = [$batchId];

    if ($statusFilter !== 'all') {
        $where   .= ' AND status = ?';
        $params[] = $statusFilter;
    }

    // Total count
    $cStmt = $db->prepare("SELECT COUNT(*) FROM import_staging WHERE {$where}");
    $cStmt->execute($params);
    $total = (int)$cStmt->fetchColumn();

    // Fetch rows
    $params[] = $limit;
    $params[] = $offset;
    $rStmt = $db->prepare(
        "SELECT id, `row_number`, status, validation_errors, validation_warnings, cleaned_data
           FROM import_staging
          WHERE {$where}
          ORDER BY `row_number` ASC
          LIMIT ? OFFSET ?"
    );
    $rStmt->execute($params);

    $rows = [];
    while ($row = $rStmt->fetch(PDO::FETCH_ASSOC)) {
        $cleaned  = json_decode($row['cleaned_data']  ?? '{}', true) ?? [];
        $errors   = json_decode($row['validation_errors']   ?? '[]', true) ?? [];
        $warnings = json_decode($row['validation_warnings'] ?? '[]', true) ?? [];

        $rows[] = [
            'id'         => (int)$row['id'],
            'row_number' => (int)$row['row_number'],
            'status'     => $row['status'],
            'pdid'       => $cleaned['pdid']       ?? null,
            'site_name'  => $cleaned['site_name']  ?? null,
            'status_po'  => $cleaned['status_po']  ?? null,
            'error_count'   => count($errors),
            'warning_count' => count($warnings),
            'errors'   => $errors,
            'warnings' => $warnings,
        ];
    }

    jsonSuccess([
        'batch'  => $batchMeta,
        'rows'   => $rows,
        'meta'   => [
            'total'       => $total,
            'page'        => $page,
            'limit'       => $limit,
            'total_pages' => (int)ceil($total / $limit),
        ],
    ]);

} catch (Throwable $e) {
    jsonError('Failed to load staging rows: ' . $e->getMessage(), 500);
}
