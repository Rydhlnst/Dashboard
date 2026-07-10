<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../helpers/report_filter.php';
require_once __DIR__ . '/../../models/AuditLog.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Content-Type: application/json; charset=utf-8');
    jsonError('Method not allowed.', 405);
}

$user = requireAuth();
$db   = getDB();

// Build the same filter conditions as projects/index.php
$conditions = ['p.deleted_at IS NULL'];
$params = [];

$search = trim($_GET['search'] ?? '');
if ($search !== '') {
    $conditions[] = '(p.pdid LIKE ? OR p.site_name LIKE ? OR p.siteid_act LIKE ? OR p.pono_tsel LIKE ?)';
    $like = "%{$search}%";
    array_push($params, $like, $like, $like, $like);
}

$simpleFilters = [
    'dataset_type','status_po','status_project','project_category',
    'vendor_principle','mitra_impl','nop','tp_detail','rfs_month','po_year','province','city',
];
foreach ($simpleFilters as $f) {
    $val = trim($_GET[$f] ?? '');
    if ($val !== '') {
        $conditions[] = "p.{$f} = ?";
        $params[] = $val;
    }
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
$sql = "SELECT p.* FROM project_records p {$where} ORDER BY p.id ASC LIMIT 50000";
$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($rows)) {
    header('Content-Type: application/json; charset=utf-8');
    jsonError('No data to export.', 404);
}

AuditLog::log($user['id'], 'export_csv', 'project_records', null, 'Exported ' . count($rows) . ' rows to CSV');

// Stream CSV
$filename = 'export_' . date('Ymd_His') . '.csv';
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-cache');

$out = fopen('php://output', 'w');
fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM for Excel

// Header row from first record keys (excluding custom_fields)
$skip = ['custom_fields'];
$headers = array_filter(array_keys($rows[0]), fn($k) => !in_array($k, $skip));
fputcsv($out, array_values($headers));

foreach ($rows as $row) {
    $csvRow = [];
    foreach ($headers as $h) {
        $csvRow[] = $row[$h] ?? '';
    }
    fputcsv($out, $csvRow);
}
fclose($out);
exit;


