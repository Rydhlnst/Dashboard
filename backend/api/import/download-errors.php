<?php
/**
 * GET /api/import/download-errors.php?batch_id=N&status=error,warning
 *
 * Streams a UTF-8 CSV with all error/warning rows from a batch so
 * the admin can fix them and re-import.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Content-Type: application/json');
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

requireAdmin();

$batchId = (int)($_GET['batch_id'] ?? 0);
if ($batchId <= 0) {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'batch_id required.']);
    exit;
}

// Default: error + warning rows
$statusParam = $_GET['status'] ?? 'error,warning';
$statuses    = array_filter(array_map('trim', explode(',', $statusParam)));
$allowed     = ['error','warning','valid','pending','imported'];
$statuses    = array_values(array_intersect($statuses, $allowed));
if (empty($statuses)) $statuses = ['error','warning'];

try {
    $db = getDB();

    // Verify batch
    $bStmt = $db->prepare("SELECT dataset_type FROM import_batches WHERE id=? LIMIT 1");
    $bStmt->execute([$batchId]);
    $batch = $bStmt->fetch(PDO::FETCH_ASSOC);
    if (!$batch) {
        header('Content-Type: application/json');
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Batch not found.']);
        exit;
    }

    $placeholders = implode(',', array_fill(0, count($statuses), '?'));
    $rStmt = $db->prepare(
        "SELECT `row_number`, status, raw_data, validation_errors, validation_warnings
           FROM import_staging
          WHERE batch_id=? AND status IN ({$placeholders})
          ORDER BY `row_number` ASC"
    );
    $rStmt->execute(array_merge([$batchId], $statuses));

    $filename = "import_errors_batch{$batchId}_" . date('Ymd_His') . '.csv';

    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    header('Cache-Control: no-store');

    $out = fopen('php://output', 'w');
    // BOM for Excel UTF-8 compatibility
    fputs($out, "\xEF\xBB\xBF");

    // Collect all unique raw headers across rows for CSV columns
    $firstRow = true;
    $headers  = [];
    $buffer   = [];

    while ($row = $rStmt->fetch(PDO::FETCH_ASSOC)) {
        $raw      = json_decode($row['raw_data']              ?? '{}', true) ?? [];
        $errors   = json_decode($row['validation_errors']     ?? '[]', true) ?? [];
        $warnings = json_decode($row['validation_warnings']   ?? '[]', true) ?? [];

        if ($firstRow) {
            $headers = array_merge(['_row_number','_status','_errors','_warnings'], array_keys($raw));
            fputcsv($out, $headers);
            $firstRow = false;
        }

        $errorMsgs   = implode(' | ', array_column($errors,   'message'));
        $warningMsgs = implode(' | ', array_column($warnings, 'message'));

        $line = ['_row_number' => $row['row_number'], '_status' => $row['status'],
                 '_errors' => $errorMsgs, '_warnings' => $warningMsgs];
        foreach ($raw as $h => $v) $line[$h] = $v;

        fputcsv($out, array_map(fn($h) => $line[$h] ?? '', $headers));
    }

    fclose($out);

} catch (Throwable $e) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
