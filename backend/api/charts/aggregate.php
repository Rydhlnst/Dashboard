<?php
/**
 * GET /api/charts/aggregate.php
 *
 * Dynamic GROUP BY aggregation for chart data.
 *
 * Params:
 *   dataset_id : int    (required)
 *   x_col      : string (required) — column to GROUP BY
 *   y_agg      : COUNT|SUM|AVG|MAX|MIN  (default COUNT)
 *   y_col      : string — column for SUM/AVG/MAX/MIN (required when y_agg ≠ COUNT)
 *   filter_col : string — column to filter on (optional)
 *   filter_val : string — filter value (optional, LIKE for text, = for numeric/date)
 *   sort_by    : value_desc|value_asc|label_asc|label_desc (default value_desc)
 *   limit      : int    max 200 (default 20)
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/schema_builder.php';

header('Content-Type: application/json; charset=utf-8');

requireAdmin();

$datasetId = (int)($_GET['dataset_id'] ?? 0);
$xCol      = trim($_GET['x_col']       ?? '');
$yAgg      = strtoupper(trim($_GET['y_agg'] ?? 'COUNT'));
$yCol      = trim($_GET['y_col']       ?? '');
$filterCol = trim($_GET['filter_col']  ?? '');
$filterVal = trim($_GET['filter_val']  ?? '');
$sortBy    = trim($_GET['sort_by']     ?? 'value_desc');
$limitRows = min((int)($_GET['limit']  ?? 20), 200);
if ($limitRows < 1) $limitRows = 20;

if ($datasetId <= 0) jsonError('dataset_id is required.', 400);
if ($xCol === '')    jsonError('x_col is required.', 400);

$allowedAgg = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN'];
if (!in_array($yAgg, $allowedAgg, true)) {
    jsonError('y_agg must be COUNT, SUM, AVG, MAX, or MIN.', 400);
}

$allowedSort = ['value_desc', 'value_asc', 'label_asc', 'label_desc'];
if (!in_array($sortBy, $allowedSort, true)) {
    $sortBy = 'value_desc';
}

try {
    $db = getDB();

    $dStmt = $db->prepare("SELECT * FROM datasets WHERE id=? LIMIT 1");
    $dStmt->execute([$datasetId]);
    $dataset = $dStmt->fetch(PDO::FETCH_ASSOC);
    if (!$dataset) jsonError("Dataset #{$datasetId} not found.", 404);

    $tableName  = $dataset['table_name'];
    $schema     = json_decode($dataset['columns_schema'] ?? '[]', true) ?? [];

    // Build valid col_name → col_type map from schema
    $colTypeMap = [];
    foreach ($schema as $col) {
        $cn = $col['col_name'] ?? '';
        if ($cn !== '') $colTypeMap[$cn] = $col['col_type'] ?? 'VARCHAR(255)';
    }

    // Sanitize and validate x_col
    $safeXCol = sanitizeColName($xCol);
    if (!isset($colTypeMap[$safeXCol])) {
        jsonError("Column '{$xCol}' not found in dataset schema.", 400);
    }

    // Build Y expression
    if ($yAgg === 'COUNT') {
        $yExpr = 'COUNT(*)';
    } else {
        if ($yCol === '') jsonError("y_col is required when y_agg is {$yAgg}.", 400);
        $safeYCol = sanitizeColName($yCol);
        if (!isset($colTypeMap[$safeYCol])) {
            jsonError("Column '{$yCol}' not found in dataset schema.", 400);
        }
        $yExpr = "{$yAgg}(`{$safeYCol}`)";
    }

    // Build WHERE clause (parameterized — only the value is a param)
    $whereClause = '';
    $queryParams = [];
    if ($filterCol !== '' && $filterVal !== '') {
        $safeFilter = sanitizeColName($filterCol);
        if (isset($colTypeMap[$safeFilter])) {
            $filterType = $colTypeMap[$safeFilter];
            $isText = (strpos($filterType, 'VARCHAR') !== false || strpos($filterType, 'TEXT') !== false);
            if ($isText) {
                $whereClause   = "WHERE `{$safeFilter}` LIKE ?";
                $queryParams[] = '%' . $filterVal . '%';
            } else {
                $whereClause   = "WHERE `{$safeFilter}` = ?";
                $queryParams[] = $filterVal;
            }
        }
    }

    // Build ORDER BY
    switch ($sortBy) {
        case 'value_asc':  $orderBy = 'ORDER BY value ASC';  break;
        case 'label_asc':  $orderBy = 'ORDER BY label ASC';  break;
        case 'label_desc': $orderBy = 'ORDER BY label DESC'; break;
        default:           $orderBy = 'ORDER BY value DESC';
    }

    $sql = "SELECT COALESCE(CAST(`{$safeXCol}` AS CHAR), '(empty)') AS label,
                   {$yExpr} AS value
              FROM `{$tableName}`
              {$whereClause}
             GROUP BY `{$safeXCol}`
             {$orderBy}
             LIMIT {$limitRows}";

    $stmt = $db->prepare($sql);
    $stmt->execute($queryParams);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $items = [];
    foreach ($rows as $row) {
        $items[] = [
            'label' => (string)($row['label'] ?? ''),
            'value' => (float)($row['value']  ?? 0),
        ];
    }

    jsonSuccess([
        'group_by' => $safeXCol,
        'items'    => $items,
        'total'    => count($items),
    ]);

} catch (Throwable $e) {
    jsonError('Aggregate failed: ' . $e->getMessage(), 500);
}
