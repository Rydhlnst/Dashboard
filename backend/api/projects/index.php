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

$db = getDB();

[$page, $limit, $offset] = paginationParams();

$allowedSort = [
    'id','pdid','po_year','status_po','status_project','project_category','nop','tp_detail',
    'vendor_principle','mitra_impl','rfs_month','rfs_actual','progress_done_flag',
    'province','city','dataset_type','created_at','updated_at',
];
$sortBy  = allowedSortColumn($_GET['sort_by'] ?? 'id', $allowedSort, 'id');
$sortDir = allowedSortDir($_GET['sort_dir'] ?? 'ASC');

$conditions = ['p.deleted_at IS NULL'];
$params     = [];

$search = trim($_GET['search'] ?? '');
if ($search !== '') {
    $conditions[] = '(p.pdid LIKE ? OR p.site_name LIKE ? OR p.siteid_act LIKE ? OR p.pono_tsel LIKE ? OR p.nop LIKE ?)';
    $like = "%{$search}%";
    array_push($params, $like, $like, $like, $like, $like);
}

$simpleFilters = [
    'dataset_type'     => 'p.dataset_type',
    'status_po'        => 'p.status_po',
    'status_project'   => 'p.status_project',
    'project_category' => 'p.project_category',
    'vendor_principle' => 'p.vendor_principle',
    'mitra_impl'       => 'p.mitra_impl',
    'nop'              => 'p.nop',
    'tp_detail'        => 'p.tp_detail',
    'rfs_month'        => 'p.rfs_month',
    'po_year'          => 'p.po_year',
    'province'         => 'p.province',
    'city'             => 'p.city',
    'band'             => 'p.band',
];

foreach ($simpleFilters as $param => $column) {
    $val = trim($_GET[$param] ?? '');
    if ($val !== '') {
        $conditions[] = "{$column} = ?";
        $params[]     = $val;
    }
}

// Blocking filter
if (isset($_GET['blocking']) && $_GET['blocking'] !== '') {
    $conditions[] = 'p.blocking = ?';
    $params[]     = (int)$_GET['blocking'];
}

applyReportDateFilter($conditions, $params, 'p');

// Progress status filter
$progressStatus = trim($_GET['progress_status'] ?? '');
if ($progressStatus === 'Completed') {
    $conditions[] = "(p.progress_done_flag = '1' OR (p.rfs_actual IS NOT NULL))";
} elseif ($progressStatus === 'Dropped') {
    $conditions[] = "(LOWER(p.status_po) = 'drop' OR p.progress_done_flag = 'x')";
} elseif ($progressStatus === 'Not Yet') {
    $conditions[] = "p.progress_done_flag NOT IN ('1','x')";
    $conditions[] = "(p.rfs_actual IS NULL)";
    $conditions[] = "LOWER(p.status_po) != 'drop'";
}

$where = 'WHERE ' . implode(' AND ', $conditions);

$countSql = "SELECT COUNT(*) FROM project_records p {$where}";
$stmt     = $db->prepare($countSql);
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

$dataSql = "SELECT p.* FROM project_records p {$where} ORDER BY p.{$sortBy} {$sortDir} LIMIT ? OFFSET ?";
$stmt = $db->prepare($dataSql);
$stmt->execute(array_merge($params, [$limit, $offset]));
$rows = $stmt->fetchAll();

foreach ($rows as &$row) {
    $row['id']              = (int)$row['id'];
    $row['import_batch_id'] = $row['import_batch_id'] ? (int)$row['import_batch_id'] : null;
    $row['blocking']        = (bool)$row['blocking'];
    $row['capex']           = $row['capex'] !== null ? (float)$row['capex'] : null;
    $row['lat']             = $row['lat']   !== null ? (float)$row['lat']   : null;
    $row['lng']             = $row['lng']   !== null ? (float)$row['lng']   : null;
    $row['price_po']           = $row['price_po']           !== null ? (float)$row['price_po']           : null;
    $row['price_po_to_be_claim'] = $row['price_po_to_be_claim'] !== null ? (float)$row['price_po_to_be_claim'] : null;
    $row['price_bast']         = $row['price_bast']         !== null ? (float)$row['price_bast']         : null;
    $row['remaining_po']       = $row['remaining_po']       !== null ? (float)$row['remaining_po']       : null;
    $row['plan_po']            = $row['plan_po']            !== null ? (float)$row['plan_po']            : null;
    $row['released_po']        = $row['released_po']        !== null ? (float)$row['released_po']        : null;
    if ($row['custom_fields'] !== null) {
        $row['custom_fields'] = json_decode($row['custom_fields'], true) ?? [];
    }
}
unset($row);

jsonPaginated($rows, $total, $page, $limit);


