<?php
/**
 * GET /api/analytics/dataset-summary.php?dataset_id=N
 *
 * Returns summary stats for a specific dynamic dataset (ds_* table):
 *   - kpi: total rows, column count, last update
 *   - charts: group-by breakdown for categorical columns (top-10 each, up to 6 columns)
 *   - numeric_stats: SUM/AVG for numeric columns
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonError('Method not allowed.', 405);
requireAuth();

$datasetId = (int)($_GET['dataset_id'] ?? 0);
if ($datasetId <= 0) jsonError('dataset_id is required.', 400);

$db = getDB();

$dStmt = $db->prepare("SELECT id, name, table_name, column_count, row_count, columns_schema, updated_at FROM datasets WHERE id = ? LIMIT 1");
$dStmt->execute([$datasetId]);
$dataset = $dStmt->fetch(PDO::FETCH_ASSOC);
if (!$dataset) jsonError('Dataset not found.', 404);

$tableName = $dataset['table_name'];
$schema    = json_decode($dataset['columns_schema'] ?? '[]', true);
if (!is_array($schema)) $schema = [];

// ── Total row count ──────────────────────────────────────────────────────────
try {
    $total = (int)$db->query("SELECT COUNT(*) FROM `{$tableName}`")->fetchColumn();
} catch (Throwable $e) {
    jsonError('Could not query table: ' . $e->getMessage(), 500);
}

// ── Last update: prefer _imported_at, fallback to first DATE/DATETIME col ───
$lastUpdate = null;
$internalCols = ['_imported_at', '_batch_id', '_staging_id', '_row_hash'];
foreach ($internalCols as $icol) {
    try {
        $val = $db->query("SELECT MAX(`{$icol}`) FROM `{$tableName}`")->fetchColumn();
        if ($val) { $lastUpdate = $val; break; }
    } catch (Throwable) {}
}
if (!$lastUpdate) {
    foreach ($schema as $col) {
        $cn = $col['col_name'] ?? '';
        $ct = strtoupper($col['col_type'] ?? '');
        if ($cn === '' || $cn[0] === '_') continue;
        if (strpos($ct, 'DATETIME') !== false || strpos($ct, 'DATE') !== false) {
            try {
                $val = $db->query("SELECT MAX(`{$cn}`) FROM `{$tableName}`")->fetchColumn();
                if ($val) { $lastUpdate = $val; break; }
            } catch (Throwable) {}
        }
    }
}

// ── Categorical column charts (text columns, skip internal, limit 6 charts) ──
$charts     = [];
$chartLimit = 6;

foreach ($schema as $col) {
    if (count($charts) >= $chartLimit) break;
    $cn = $col['col_name'] ?? '';
    $ct = strtoupper($col['col_type'] ?? '');
    if ($cn === '' || $cn[0] === '_') continue;
    $isText = strpos($ct, 'VARCHAR') !== false || strpos($ct, 'TEXT') !== false || strpos($ct, 'CHAR') !== false;
    if (!$isText) continue;

    try {
        $stmt = $db->query(
            "SELECT COALESCE(NULLIF(TRIM(`{$cn}`), ''), 'Unknown') AS label, COUNT(*) AS value
               FROM `{$tableName}`
              GROUP BY label
              ORDER BY value DESC
              LIMIT 10"
        );
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // Skip columns with only 1 distinct value (boring) or with too many distinct values (IDs)
        $distinctCount = count($rows);
        if ($distinctCount < 2 || $distinctCount > 9) continue;

        $charts[] = [
            'col'   => $cn,
            'items' => array_map(fn($r) => [
                'label' => (string)$r['label'],
                'value' => (int)$r['value'],
            ], $rows),
        ];
    } catch (Throwable) {}
}

// ── Numeric column stats ─────────────────────────────────────────────────────
$numericStats = [];
foreach ($schema as $col) {
    $cn = $col['col_name'] ?? '';
    $ct = strtoupper($col['col_type'] ?? '');
    if ($cn === '' || $cn[0] === '_') continue;
    $isNumeric = strpos($ct, 'INT') !== false || strpos($ct, 'DECIMAL') !== false
              || strpos($ct, 'FLOAT') !== false || strpos($ct, 'DOUBLE') !== false;
    if (!$isNumeric) continue;

    try {
        $stmt = $db->query(
            "SELECT SUM(`{$cn}`) AS total, AVG(`{$cn}`) AS avg, COUNT(`{$cn}`) AS filled
               FROM `{$tableName}`"
        );
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ((int)($row['filled'] ?? 0) === 0) continue;
        $numericStats[] = [
            'col'    => $cn,
            'total'  => round((float)($row['total'] ?? 0), 2),
            'avg'    => round((float)($row['avg']   ?? 0), 2),
            'filled' => (int)($row['filled'] ?? 0),
        ];
    } catch (Throwable) {}
}

jsonSuccess([
    'dataset' => [
        'id'           => (int)$dataset['id'],
        'name'         => $dataset['name'],
        'table_name'   => $tableName,
        'column_count' => count($schema),
        'updated_at'   => $dataset['updated_at'],
    ],
    'kpi' => [
        'total'        => $total,
        'column_count' => count($schema),
        'last_update'  => $lastUpdate,
    ],
    'charts'       => $charts,
    'numeric_stats' => $numericStats,
]);
