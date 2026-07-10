<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../helpers/report_filter.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed.', 405);
}

requireAuth();

$allowedGroupBy = [
    'status_project','status_po','province','city','mitra_impl','project_category',
    'rfs_month','atp_status','lv_status','oac_status','qc_status','sqac_status',
    'baut_status','bast_status','band','sector','infra_type','cr_status',
    'issue_category','vendor_principle','blocking','current_position','pic_blocking','donor_progress'
];

$groupBy = trim($_GET['group_by'] ?? 'status_project');
if (!in_array($groupBy, $allowedGroupBy, true)) {
    jsonError('Invalid group_by parameter.', 400);
}

$metric = trim($_GET['metric'] ?? 'count');
$allowedMetrics = ['count', 'avg_progress_act', 'avg_progress_closing'];
if (!in_array($metric, $allowedMetrics, true)) {
    jsonError('Invalid metric parameter.', 400);
}

$db = getDB();

// Build WHERE clause filters
$conditions = [];
$params     = [];

$filterFields = [
    'status_project', 'status_po', 'province', 'city', 'mitra_impl', 
    'vendor_principle', 'issue_category', 'rfs_month', 'pic_blocking', 'current_position'
];

foreach ($filterFields as $field) {
    $val = trim($_GET[$field] ?? '');
    if ($val !== '') {
        $conditions[] = "{$field} = ?";
        $params[]     = $val;
    }
}

if (isset($_GET['blocking']) && $_GET['blocking'] !== '') {
    $conditions[] = 'blocking = ?';
    $params[]     = (int)$_GET['blocking'];
}

// Build SQL based on metric
$selectValue = "COUNT(*)";
if ($metric === 'avg_progress_act') {
    $conditions[] = "progress_act REGEXP '^[0-9]+(\\\.[0-9]+)?$'";
    $selectValue  = "ROUND(AVG(CAST(progress_act AS DECIMAL(10,2))), 2)";
} elseif ($metric === 'avg_progress_closing') {
    $conditions[] = "progress_closing REGEXP '^[0-9]+(\\\.[0-9]+)?$'";
    $selectValue  = "ROUND(AVG(CAST(progress_closing AS DECIMAL(10,2))), 2)";
}

applyReportDateFilter($conditions, $params, '');

$where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
$sql   = "SELECT COALESCE(NULLIF(TRIM({$groupBy}), ''), 'Unknown') AS label, {$selectValue} AS value
          FROM project_records {$where}
          GROUP BY label
          ORDER BY value DESC
          LIMIT 100";

try {
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $data = array_map(fn($r) => [
        'label' => $r['label'],
        'value' => is_numeric($r['value']) ? (float)$r['value'] : 0
    ], $rows);

    jsonSuccess([
        'group_by' => $groupBy,
        'metric'   => $metric,
        'items'    => $data,
        'total'    => ($metric === 'count') ? (float)array_sum(array_column($data, 'value')) : null
    ]);

} catch (PDOException $e) {
    jsonError('Database query failed: ' . $e->getMessage(), 500);
}


