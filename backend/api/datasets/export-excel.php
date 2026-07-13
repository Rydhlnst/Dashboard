<?php
/**
 * GET /api/datasets/export-excel.php?dataset_id=…&search=…
 *
 * Streams an .xlsx export of a dynamic ds_* table, styled like backend/api/export/excel.php.
 * Numeric/date cells are written as raw values so Excel treats them as numbers/dates,
 * while column format strings mirror the Kal TI Reeng CSV convention.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/schema_builder.php';
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
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Shared\Date as SharedDate;

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

    $stmt = $db->prepare("SELECT * FROM `{$tableName}` WHERE {$where} ORDER BY `_id` ASC LIMIT 100000");
    $stmt->execute($params);

    AuditLog::log($user['id'], 'export_dataset_excel', $tableName, $datasetId, 'Excel export of dataset');

    $spreadsheet = new Spreadsheet();
    $sheet       = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Export');

    // ── Header row ────────────────────────────────────────────────────────────
    $colIdx = 1;
    foreach ($schema as $col) {
        $sheet->setCellValueByColumnAndRow($colIdx, 1, $col['label'] ?? $col['col_name']);
        $colIdx++;
    }
    $lastCol = $sheet->getHighestColumn();
    $sheet->getStyle('A1:' . $lastCol . '1')->applyFromArray([
        'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
        'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '0F766E']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
    ]);

    // ── Body ──────────────────────────────────────────────────────────────────
    $rowNum = 2;
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $colIdx = 1;
        foreach ($schema as $col) {
            $raw  = $row[$col['col_name']] ?? null;
            $type = strtoupper($col['col_type']);
            $cell = $sheet->getCellByColumnAndRow($colIdx, $rowNum);

            if ($raw === null || $raw === '') {
                $cell->setValue('');
            } elseif ($type === 'DATE') {
                $ts = strtotime((string)$raw);
                if ($ts && $ts > 0) {
                    $cell->setValue(SharedDate::PHPToExcel($ts));
                    $cell->getStyle()->getNumberFormat()->setFormatCode('d/mmm/yy');
                } else {
                    $cell->setValue((string)$raw);
                }
            } elseif ($type === 'DECIMAL(18,4)') {
                $cell->setValue((float)$raw);
                $cell->getStyle()->getNumberFormat()->setFormatCode('#,##0.00');
            } elseif (in_array($type, ['SMALLINT UNSIGNED','INT UNSIGNED','BIGINT UNSIGNED'], true)) {
                $cell->setValue((int)$raw);
                $cell->getStyle()->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER_COMMA_SEPARATED1);
            } else {
                $cell->setValueExplicit((string)$raw, \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
            }
            $colIdx++;
        }
        $rowNum++;
    }

    // Auto-size first 10 columns only (perf)
    for ($i = 1; $i <= min(10, count($schema)); $i++) {
        $sheet->getColumnDimensionByColumn($i)->setAutoSize(true);
    }

    $safeName = preg_replace('/[^A-Za-z0-9_-]+/', '_', $dataset['name']);
    $filename = ($safeName ?: 'dataset') . '_' . date('Ymd_His') . '.xlsx';

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-cache');

    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    exit;

} catch (Throwable $e) {
    header('Content-Type: application/json; charset=utf-8');
    jsonError('Export failed: ' . $e->getMessage(), 500);
}
