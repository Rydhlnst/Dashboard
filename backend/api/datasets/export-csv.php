<?php
/**
 * GET /api/datasets/export-csv.php?dataset_id=…&search=…
 *
 * Streams a sanitized CSV export of a dynamic ds_* table.
 * Headers = original file labels (from columns_schema).
 * Values are formatted to match the source CSV convention:
 *   DATE     → d/M/yy   (e.g. 27/Apr/25)
 *   DECIMAL  → 12,345.67 (thousand separators)
 *   INT      → 12,345
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/schema_builder.php';
require_once __DIR__ . '/../../models/AuditLog.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Content-Type: application/json; charset=utf-8');
    jsonError('Method not allowed.', 405);
}

$user      = requireAuth();
$datasetId = (int)($_GET['dataset_id'] ?? 0);
if ($datasetId <= 0) {
    header('Content-Type: application/json; charset=utf-8');
    jsonError('dataset_id is required.', 400);
}

$search = trim($_GET['search'] ?? '');

try {
    $db = getDB();

    $dStmt = $db->prepare("SELECT * FROM datasets WHERE id=? LIMIT 1");
    $dStmt->execute([$datasetId]);
    $dataset = $dStmt->fetch(PDO::FETCH_ASSOC);
    if (!$dataset) {
        header('Content-Type: application/json; charset=utf-8');
        jsonError("Dataset #{$datasetId} not found.", 404);
    }

    $tableName = $dataset['table_name'];
    if (!preg_match('/^ds_[a-z0-9_]+$/', $tableName)) {
        header('Content-Type: application/json; charset=utf-8');
        jsonError('Invalid dataset table name.', 400);
    }
    $schema = json_decode($dataset['columns_schema'] ?? '[]', true) ?? [];

    // WHERE for search (same rules as query.php)
    $where  = '1=1';
    $params = [];
    if ($search !== '') {
        $searchCols = [];
        foreach ($schema as $col) {
            $type = strtoupper($col['col_type']);
            if (strpos($type, 'VARCHAR') !== false || strpos($type, 'TEXT') !== false) {
                $safe = sanitizeColName($col['col_name']);
                $searchCols[] = "`{$safe}` LIKE ?";
                $params[]     = '%' . $search . '%';
            }
        }
        if (!empty($searchCols)) $where = '(' . implode(' OR ', $searchCols) . ')';
    }

    $sql  = "SELECT * FROM `{$tableName}` WHERE {$where} ORDER BY `_id` ASC LIMIT 100000";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    AuditLog::log($user['id'], 'export_dataset_csv', $tableName, $datasetId, 'CSV export of dataset');

    $safeName = preg_replace('/[^A-Za-z0-9_-]+/', '_', $dataset['name']);
    $filename = ($safeName ?: 'dataset') . '_' . date('Ymd_His') . '.csv';

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-cache');

    $out = fopen('php://output', 'w');
    fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));   // UTF-8 BOM for Excel

    // Header row = original labels, in schema order
    $labels = [];
    foreach ($schema as $col) $labels[] = $col['label'] ?? $col['col_name'];
    fputcsv($out, $labels);

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $csvRow = [];
        foreach ($schema as $col) {
            $csvRow[] = formatCellForExport($row[$col['col_name']] ?? null, $col['col_type']);
        }
        fputcsv($out, $csvRow);
    }
    fclose($out);
    exit;

} catch (Throwable $e) {
    header('Content-Type: application/json; charset=utf-8');
    jsonError('Export failed: ' . $e->getMessage(), 500);
}

/**
 * Format a stored value back to the source-file convention used by Kal TI Reeng CSVs:
 *   DATE      → d/M/yy
 *   DECIMAL   → "12,345.6789" trimmed of trailing zeros
 *   INT/BIGINT → thousand-separated integer
 *   NULL/''   → ''
 */
function formatCellForExport($value, string $colType): string
{
    if ($value === null || $value === '') return '';

    $type = strtoupper(trim($colType));

    if ($type === 'DATE') {
        $ts = strtotime((string)$value);
        if ($ts && $ts > 0) return date('j/M/y', $ts);
        return (string)$value;
    }

    if ($type === 'DECIMAL(18,4)') {
        $num = (float)$value;
        // Match source style: no forced decimals, keep meaningful ones
        $decimals = (fmod($num, 1.0) === 0.0) ? 0 : 2;
        return number_format($num, $decimals, '.', ',');
    }

    if ($type === 'SMALLINT UNSIGNED' || $type === 'INT UNSIGNED' || $type === 'BIGINT UNSIGNED') {
        return number_format((int)$value, 0, '.', ',');
    }

    return (string)$value;
}
