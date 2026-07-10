<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../helpers/report_filter.php';
require_once __DIR__ . '/../../models/AuditLog.php';

$autoload = __DIR__ . '/../../vendor/autoload.php';
if (!file_exists($autoload)) {
    header('Content-Type: application/json; charset=utf-8');
    jsonError('PhpSpreadsheet not installed.', 500);
}
require_once $autoload;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Content-Type: application/json; charset=utf-8');
    jsonError('Method not allowed.', 405);
}

$user = requireAuth();
$db   = getDB();

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

AuditLog::log($user['id'], 'export_excel', 'project_records', null, 'Exported ' . count($rows) . ' rows to Excel');

$skip = ['custom_fields'];
$headers = array_filter(array_keys($rows[0]), fn($k) => !in_array($k, $skip));
$headers = array_values($headers);

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Export');

// Write header row with style
$col = 1;
foreach ($headers as $h) {
    $sheet->setCellValueByColumnAndRow($col, 1, $h);
    $col++;
}

$headerStyle = [
    'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '0F766E']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
];
$sheet->getStyle('A1:' . $sheet->getHighestColumn() . '1')->applyFromArray($headerStyle);

// Write data rows
$rowNum = 2;
foreach ($rows as $row) {
    $col = 1;
    foreach ($headers as $h) {
        $sheet->setCellValueByColumnAndRow($col, $rowNum, $row[$h] ?? '');
        $col++;
    }
    $rowNum++;
}

// Auto-size first 10 columns
for ($i = 1; $i <= min(10, count($headers)); $i++) {
    $sheet->getColumnDimensionByColumn($i)->setAutoSize(true);
}

$filename = 'export_' . date('Ymd_His') . '.xlsx';
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-cache');

$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit;



