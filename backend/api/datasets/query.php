<?php
/**
 * GET /api/datasets/query.php
 *
 * Paginated, searchable data fetch from a dynamic ds_* table.
 *
 * Query params:
 *   dataset_id  int     required
 *   page        int     default 1
 *   limit       int     default 50 (max 200)
 *   search      string  optional — searches all VARCHAR/TEXT columns
 *   sort_col    string  optional — column name to sort by
 *   sort_dir    string  optional — asc|desc (default asc)
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/schema_builder.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed.', 405);
}

requireAdmin();

$datasetId = (int)($_GET['dataset_id'] ?? 0);
if ($datasetId <= 0) jsonError('dataset_id is required.', 400);

$page    = max(1,   (int)($_GET['page']  ?? 1));
$limit   = min(200, max(1, (int)($_GET['limit'] ?? 50)));
$offset  = ($page - 1) * $limit;
$search  = trim($_GET['search']   ?? '');
$sortCol = trim($_GET['sort_col'] ?? '');
$sortDir = strtolower(trim($_GET['sort_dir'] ?? 'asc')) === 'desc' ? 'DESC' : 'ASC';

try {
    $db = getDB();

    // ── Load dataset schema ───────────────────────────────────────────────────
    $dStmt = $db->prepare("SELECT * FROM datasets WHERE id=? LIMIT 1");
    $dStmt->execute([$datasetId]);
    $dataset = $dStmt->fetch(PDO::FETCH_ASSOC);
    if (!$dataset) jsonError("Dataset #{$datasetId} not found.", 404);

    $tableName = $dataset['table_name'];
    $schema    = json_decode($dataset['columns_schema'] ?? '[]', true) ?? [];

    // Sanitise sort column
    $orderBy = '`_id` ASC';
    if ($sortCol !== '') {
        $safeSortCol = sanitizeColName($sortCol);
        // Only allow sorting on columns that exist in schema
        $schemaCols = array_column($schema, 'col_name');
        if (in_array($safeSortCol, $schemaCols, true)) {
            $orderBy = "`{$safeSortCol}` {$sortDir}";
        }
    }

    // ── Build WHERE clause for search ────────────────────────────────────────
    $where  = '1=1';
    $params = [];

    if ($search !== '') {
        $searchCols = [];
        foreach ($schema as $col) {
            $type = strtoupper($col['col_type']);
            // Only search text-type columns
            if (strpos($type, 'VARCHAR') !== false || strpos($type, 'TEXT') !== false) {
                $safe = sanitizeColName($col['col_name']);
                $searchCols[] = "`{$safe}` LIKE ?";
                $params[]     = '%' . $search . '%';
            }
        }
        if (!empty($searchCols)) {
            $where = '(' . implode(' OR ', $searchCols) . ')';
        }
    }

    // ── Count total ───────────────────────────────────────────────────────────
    $cStmt = $db->prepare("SELECT COUNT(*) FROM `{$tableName}` WHERE {$where}");
    $cStmt->execute($params);
    $total = (int)$cStmt->fetchColumn();

    // ── Fetch page ────────────────────────────────────────────────────────────
    $fetchParams   = array_merge($params, [$limit, $offset]);
    $rStmt = $db->prepare(
        "SELECT * FROM `{$tableName}` WHERE {$where} ORDER BY {$orderBy} LIMIT ? OFFSET ?"
    );
    $rStmt->execute($fetchParams);
    $rows = $rStmt->fetchAll(PDO::FETCH_ASSOC);

    jsonSuccess([
        'dataset'  => [
            'id'         => (int)$dataset['id'],
            'name'       => $dataset['name'],
            'table_name' => $tableName,
            'schema'     => $schema,
        ],
        'rows'     => $rows,
        'meta'     => [
            'total'       => $total,
            'page'        => $page,
            'limit'       => $limit,
            'total_pages' => (int)ceil($total / max(1, $limit)),
        ],
    ]);

} catch (Throwable $e) {
    jsonError('Query failed: ' . $e->getMessage(), 500);
}
