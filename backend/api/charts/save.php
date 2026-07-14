<?php
/**
 * POST /api/charts/save.php
 *
 * Save (insert) or update a chart configuration.
 *
 * Body:
 *   id?          : int     — omit to create, provide to update
 *   name         : string  (required)
 *   dataset_id   : int     (required)
 *   chart_type   : string  bar|line|area|pie|donut|radial|scatter
 *   x_col        : string  (required) — column used for GROUP BY
 *   y_agg        : COUNT|SUM|AVG|MAX|MIN
 *   y_col?       : string  — required when y_agg ≠ COUNT
 *   filter_col?  : string
 *   filter_val?  : string
 *   sort_by      : value_desc|value_asc|label_asc|label_desc
 *   limit_rows   : int     1–200
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/schema_builder.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();
$body  = getRequestBody();

$id        = (int)($body['id']          ?? 0);
$name      = trim($body['name']         ?? '');
$datasetId = (int)($body['dataset_id']  ?? 0);
$chartType = trim($body['chart_type']   ?? 'bar');
$xCol      = trim($body['x_col']        ?? '');
$yAgg      = strtoupper(trim($body['y_agg'] ?? 'COUNT'));
$yCol      = trim($body['y_col']        ?? '');
$filterCol = trim($body['filter_col']   ?? '');
$filterVal = trim($body['filter_val']   ?? '');
$sortBy    = trim($body['sort_by']      ?? 'value_desc');
$limitRows = min(max((int)($body['limit_rows'] ?? 20), 1), 200);

if ($name === '')     jsonError('name is required.', 400);
if ($datasetId <= 0) jsonError('dataset_id is required.', 400);
if ($xCol === '')    jsonError('x_col is required.', 400);

$allowedAgg   = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN'];
$allowedTypes = ['bar', 'line', 'area', 'pie', 'donut', 'radar', 'radial', 'scatter', 'scurve'];
$allowedSort  = ['value_desc', 'value_asc', 'label_asc', 'label_desc'];

if (!in_array($yAgg, $allowedAgg, true))       jsonError('Invalid y_agg.', 400);
if (!in_array($chartType, $allowedTypes, true)) jsonError('Invalid chart_type.', 400);
if (!in_array($sortBy, $allowedSort, true))     $sortBy = 'value_desc';

$safeXCol      = sanitizeColName($xCol);
$safeYCol      = ($yCol !== '') ? sanitizeColName($yCol) : null;
$safeFilterCol = ($filterCol !== '') ? sanitizeColName($filterCol) : null;

try {
    $db = getDB();

    $dStmt = $db->prepare("SELECT id FROM datasets WHERE id=? LIMIT 1");
    $dStmt->execute([$datasetId]);
    if (!$dStmt->fetch()) jsonError("Dataset #{$datasetId} not found.", 404);

    if ($id > 0) {
        $db->prepare(
            "UPDATE saved_charts
                SET name=?, dataset_id=?, chart_type=?, x_col=?, y_agg=?,
                    y_col=?, filter_col=?, filter_val=?, sort_by=?, limit_rows=?,
                    updated_at=NOW()
              WHERE id=?"
        )->execute([
            $name, $datasetId, $chartType, $safeXCol, $yAgg,
            $safeYCol, $safeFilterCol, ($filterVal !== '' ? $filterVal : null),
            $sortBy, $limitRows, $id,
        ]);
        jsonSuccess(['id' => $id], 'Chart updated.');
    } else {
        $db->prepare(
            "INSERT INTO saved_charts
               (name, dataset_id, chart_type, x_col, y_agg,
                y_col, filter_col, filter_val, sort_by, limit_rows, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            $name, $datasetId, $chartType, $safeXCol, $yAgg,
            $safeYCol, $safeFilterCol, ($filterVal !== '' ? $filterVal : null),
            $sortBy, $limitRows, $admin['id'],
        ]);
        $newId = (int)$db->lastInsertId();
        jsonSuccess(['id' => $newId], 'Chart saved.');
    }

} catch (Throwable $e) {
    jsonError('Failed to save chart: ' . $e->getMessage(), 500);
}
