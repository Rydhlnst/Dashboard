<?php
/**
 * POST /api/import/upload.php
 *
 * Accepts a file upload, parses every row, inserts into import_staging,
 * and returns batch metadata + column detection — no data enters
 * project_records yet.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../helpers/upload.php';
require_once __DIR__ . '/../../helpers/column_map.php';

$autoload = __DIR__ . '/../../vendor/autoload.php';
if (!file_exists($autoload)) {
    jsonError('PhpSpreadsheet not installed. Run: composer install in /backend', 500);
}
require_once $autoload;

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();

if (empty($_FILES['file'])) {
    jsonError('No file uploaded.', 400);
}

$file     = $_FILES['file'];
$valError = validateExcelUpload($file);
if ($valError) jsonError($valError, 422);

$datasetType = trim($_POST['dataset_type'] ?? 'closing');
if (!in_array($datasetType, ['closing','filter900','refinement'], true)) {
    $datasetType = 'closing';
}

$tmpPath = null;
try {
    set_time_limit(120);

    $tmpPath  = moveUploadToTemp($file);
    $fileName = basename($file['name']);

    $spreadsheet = IOFactory::load($tmpPath);
    $sheet       = $spreadsheet->getActiveSheet();
    $highestRow  = $sheet->getHighestRow();
    $highestCol  = $sheet->getHighestColumn();

    if ($highestRow < 2) {
        cleanupTempFile($tmpPath);
        jsonError('File must have at least 2 rows (header + 1 data row).', 422);
    }

    // Detect header row (row 1 or row 2)
    $headerRowNum = detectHeaderRow($sheet, $highestCol);

    // Read raw headers {colLetter => headerText}
    $rawHeaders = readHeaderRow($sheet, $highestCol, $headerRowNum);

    // Map known headers → db columns
    $mappingResult = mapHeaders($rawHeaders);   // {colLetter => {header, db_col|null}}

    // Build column_map {headerText => db_col} and unknown_columns {colLetter => {header, field_key}}
    $columnMap      = [];
    $unknownColumns = [];
    $db = getDB();

    foreach ($mappingResult as $colLetter => $info) {
        if ($info['header'] === '') continue;
        if ($info['db_col'] !== null) {
            $columnMap[$info['header']] = $info['db_col'];
        } else {
            $fk = headerToFieldKey($info['header']);
            // Check if a dynamic column_definition already covers it
            $stmt = $db->prepare(
                "SELECT id FROM column_definitions WHERE field_key=? AND dataset_type IN ('all',?) AND is_archived=0 LIMIT 1"
            );
            $stmt->execute([$fk, $datasetType]);
            $existing = $stmt->fetch();

            $unknownColumns[$colLetter] = [
                'header'      => $info['header'],
                'field_key'   => $fk,
                'in_col_defs' => $existing ? true : false,
                'col_def_id'  => $existing ? (int)$existing['id'] : null,
            ];
        }
    }

    // Build preview of first 10 data rows
    $previewRows = [];
    $dataStart   = $headerRowNum + 1;
    $previewLimit = 10;

    for ($r = $dataStart; $r <= $highestRow && count($previewRows) < $previewLimit; $r++) {
        $rowData = [];
        $isEmpty = true;
        foreach ($rawHeaders as $colLetter => $header) {
            if ($header === '') continue;
            $val = getStagingCellValue($sheet->getCell($colLetter . $r));
            $rowData[$header] = $val;
            if ($val !== '') $isEmpty = false;
        }
        if (!$isEmpty) $previewRows[] = $rowData;
    }

    // Count total data rows
    $totalRows = 0;
    for ($r = $dataStart; $r <= $highestRow; $r++) {
        if (!isEmptyRow($sheet, $rawHeaders, $r)) $totalRows++;
    }

    // Create import_batch record
    $db->prepare(
        "INSERT INTO import_batches
           (file_name, dataset_type, column_map, unknown_columns, total_rows, imported_by, imported_at, batch_status)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), 'uploading')"
    )->execute([$fileName, $datasetType,
        json_encode($columnMap, JSON_UNESCAPED_UNICODE),
        json_encode($unknownColumns, JSON_UNESCAPED_UNICODE),
        $totalRows, $admin['id']
    ]);
    $batchId = (int)$db->lastInsertId();

    // Batch-insert all data rows into import_staging
    $insertSql = "INSERT INTO import_staging (batch_id, `row_number`, raw_data, status) VALUES ";
    $chunk      = [];
    $params     = [];

    for ($r = $dataStart; $r <= $highestRow; $r++) {
        $rowData = [];
        $isEmpty = true;
        foreach ($rawHeaders as $colLetter => $header) {
            if ($header === '') continue;
            $val = getStagingCellValue($sheet->getCell($colLetter . $r));
            $rowData[$header] = $val;
            if ($val !== '') $isEmpty = false;
        }
        if ($isEmpty) continue;

        $chunk[]  = "(?, ?, ?, 'pending')";
        $params[] = $batchId;
        $params[] = $r;
        $params[] = json_encode($rowData, JSON_UNESCAPED_UNICODE);

        // Flush every 500 rows
        if (count($chunk) >= 500) {
            $db->prepare($insertSql . implode(',', $chunk))->execute($params);
            $chunk  = [];
            $params = [];
        }
    }
    if (!empty($chunk)) {
        $db->prepare($insertSql . implode(',', $chunk))->execute($params);
    }

    $db->prepare("UPDATE import_batches SET batch_status='pending_validation' WHERE id=?")
       ->execute([$batchId]);

    cleanupTempFile($tmpPath);

    jsonSuccess([
        'batch_id'        => $batchId,
        'file_name'       => $fileName,
        'dataset_type'    => $datasetType,
        'total_rows'      => $totalRows,
        'column_map'      => $columnMap,      // {header: db_field}
        'unknown_columns' => $unknownColumns, // {colLetter: {header, field_key, in_col_defs}}
        'known_count'     => count($columnMap),
        'unknown_count'   => count($unknownColumns),
        'preview_rows'    => $previewRows,
    ], 'File uploaded. Review column mapping then run validation.');

} catch (Throwable $e) {
    if ($tmpPath) cleanupTempFile($tmpPath);
    jsonError('Upload failed: ' . $e->getMessage(), 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getStagingCellValue($cell): string {
    $value = $cell->getValue();
    if ($value === null) return '';

    // Resolve formula
    if ($cell->getDataType() === DataType::TYPE_FORMULA) {
        try { $value = $cell->getCalculatedValue(); }
        catch (Throwable) { $value = $cell->getOldCalculatedValue(); }
    }

    // Convert Excel serial dates to ISO string
    if ((is_float($value) || is_int($value)) && ExcelDate::isDateTime($cell)) {
        try {
            return ExcelDate::excelToDateTimeObject((float)$value)->format('Y-m-d');
        } catch (Throwable) {}
    }

    return trim((string)$value);
}

function detectHeaderRow($sheet, string $highestCol): int {
    // Row 2 is header if row 1 looks like a title (few filled cells)
    $row1Filled = 0;
    $row2Filled = 0;
    foreach ($sheet->getColumnIterator('A', $highestCol) as $col) {
        $idx = $col->getColumnIndex();
        if (trim((string)$sheet->getCell($idx . '1')->getValue()) !== '') $row1Filled++;
        if (trim((string)$sheet->getCell($idx . '2')->getValue()) !== '') $row2Filled++;
    }
    return ($row2Filled > $row1Filled) ? 2 : 1;
}

function readHeaderRow($sheet, string $highestCol, int $rowNum): array {
    $headers = [];
    foreach ($sheet->getColumnIterator('A', $highestCol) as $col) {
        $idx = $col->getColumnIndex();
        $headers[$idx] = trim((string)$sheet->getCell($idx . $rowNum)->getValue());
    }
    return $headers;
}

function isEmptyRow($sheet, array $headers, int $rowNum): bool {
    foreach (array_keys($headers) as $colLetter) {
        if (trim((string)$sheet->getCell($colLetter . $rowNum)->getValue()) !== '') return false;
    }
    return true;
}
