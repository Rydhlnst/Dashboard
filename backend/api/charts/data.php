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
    'issue_category','vendor_principle','blocking',
];

$groupBy = trim($_GET['group_by'] ?? 'status_project');
if (!in_array($groupBy, $allowedGroupBy, true)) {
    jsonError('Invalid group_by parameter.', 400);
}

$db = getDB();

// Apply filters
$conditions = [];
$params     = [];

$filterFields = ['status_project','status_po','province','city','mitra_impl','project_category','rfs_month'];
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

applyReportDateFilter($conditions, $params, '');

$where  = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
$sql    = "SELECT COALESCE({$groupBy}, 'Unknown') AS label, COUNT(*) AS value
           FROM project_records {$where}
           GROUP BY {$groupBy}
           ORDER BY value DESC
           LIMIT 100";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$data = array_map(fn($r) => ['label' => $r['label'], 'value' => (int)$r['value']], $rows);

jsonSuccess([
    'group_by' => $groupBy,
    'items'    => $data,
    'total'    => array_sum(array_column($data, 'value')),
]);


