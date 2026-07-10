<?php
/**
 * POST /api/import/upload.php
 *
 * Accepts a file upload (CSV or Excel), parses every row, inserts into
 * import_staging, and returns batch metadata + column detection.
 * No data enters project_records until the confirm step.
 *
 * CSV  → parsed with native fgetcsv() (PHP 5.3+, works on any server)
 * XLSX → parsed with PhpSpreadsheet (requires PHP 8.0+)
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../helpers/upload.php';
require_once __DIR__ . '/../../helpers/column_map.php';

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
    $ext      = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

    // ── Parse file → $rawHeaders, $parsedRows ─────────────────────────────────
    // $rawHeaders : [ 'A' => 'Header Text', 'B' => 'Header2', ... ]
    // $parsedRows : [ [ 'A' => 'val', 'B' => 'val', ... ], ... ]  (empty rows excluded)

    if ($ext === 'csv') {
        [$rawHeaders, $parsedRows] = parseCsvFile($tmpPath);
    } else {
        // Excel — requires PhpSpreadsheet which needs PHP 8.0+
        $autoload = __DIR__ . '/../../vendor/autoload.php';
        if (!file_exists($autoload)) {
            cleanupTempFile($tmpPath);
            jsonError('PhpSpreadsheet not installed. Run: composer install in /backend', 500);
        }
        if (PHP_MAJOR_VERSION < 8) {
            cleanupTempFile($tmpPath);
            jsonError('Excel upload requires PHP 8.0 or newer. Please upload a CSV file instead, or ask your host to upgrade PHP.', 500);
        }
        require_once $autoload;
        [$rawHeaders, $parsedRows] = parseExcelFile($tmpPath);
    }

    if (empty($rawHeaders) || empty($parsedRows)) {
        cleanupTempFile($tmpPath);
        jsonError('File must have at least one header row and one data row.', 422);
    }

    // ── Map headers → DB columns ───────────────────────────────────────────────
    $mappingResult = mapHeaders($rawHeaders);

    $columnMap      = [];
    $unknownColumns = [];
    $db = getDB();

    foreach ($mappingResult as $colLetter => $info) {
        if ($info['header'] === '') continue;
        if ($info['db_col'] !== null) {
            $columnMap[$info['header']] = $info['db_col'];
        } else {
            $fk = headerToFieldKey($info['header']);
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

    // ── Build preview (first 10 rows) ──────────────────────────────────────────
    $previewRows = [];
    foreach (array_slice($parsedRows, 0, 10) as $row) {
        $previewRow = [];
        foreach ($rawHeaders as $colLetter => $header) {
            if ($header === '') continue;
            $previewRow[$header] = $row[$colLetter] ?? '';
        }
        $previewRows[] = $previewRow;
    }

    $totalRows = count($parsedRows);

    // ── Create import_batch record ─────────────────────────────────────────────
    $db->prepare(
        "INSERT INTO import_batches
           (file_name, dataset_type, column_map, unknown_columns, total_rows, imported_by, imported_at, batch_status)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), 'uploading')"
    )->execute([$fileName, $datasetType,
        json_encode($columnMap, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
        json_encode($unknownColumns, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
        $totalRows, $admin['id']
    ]);
    $batchId = (int)$db->lastInsertId();

    // ── Batch-insert rows into import_staging ──────────────────────────────────
    $insertSql = "INSERT INTO import_staging (batch_id, `row_number`, raw_data, status) VALUES ";
    $chunk  = [];
    $params = [];
    $rowNum = 2; // Logical row number (1 = header)

    foreach ($parsedRows as $row) {
        $rowData = [];
        foreach ($rawHeaders as $colLetter => $header) {
            if ($header === '') continue;
            $rowData[$header] = $row[$colLetter] ?? '';
        }

        $chunk[]  = "(?, ?, ?, 'pending')";
        $params[] = $batchId;
        $params[] = $rowNum;
        $params[] = json_encode($rowData, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        $rowNum++;

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
        'column_map'      => $columnMap,
        'unknown_columns' => $unknownColumns,
        'known_count'     => count($columnMap),
        'unknown_count'   => count($unknownColumns),
        'preview_rows'    => $previewRows,
    ], 'File uploaded. Review column mapping then run validation.');

} catch (Throwable $e) {
    if ($tmpPath) cleanupTempFile($tmpPath);
    jsonError('Upload failed: ' . $e->getMessage(), 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV parser — native PHP, no dependencies
// Returns [ rawHeaders, parsedRows ]
// rawHeaders : [ 'A' => 'Header', 'B' => 'Header2', ... ]
// parsedRows : [ [ 'A' => 'val', ... ], ... ]  empty rows excluded
// ─────────────────────────────────────────────────────────────────────────────

function parseCsvFile(string $path): array
{
    $handle = fopen($path, 'r');
    if ($handle === false) throw new RuntimeException('Cannot open CSV file.');

    // Strip UTF-8 BOM if present
    $bom = fread($handle, 3);
    if ($bom !== "\xEF\xBB\xBF") rewind($handle);

    // Detect delimiter (comma vs semicolon vs tab)
    $sample = fgets($handle);
    rewind($handle);
    if ($bom === "\xEF\xBB\xBF") fread($handle, 3); // skip BOM again
    $comma     = substr_count($sample, ',');
    $semicolon = substr_count($sample, ';');
    $tab       = substr_count($sample, "\t");
    $delimiter = ',';
    if ($semicolon > $comma && $semicolon > $tab) $delimiter = ';';
    elseif ($tab > $comma && $tab > $semicolon)   $delimiter = "\t";

    // Detect encoding of the file (check first 4KB)
    $encodingSample = fread($handle, 4096);
    rewind($handle);
    if ($bom === "\xEF\xBB\xBF") fread($handle, 3); // skip BOM
    $fileEncoding = mb_detect_encoding($encodingSample, ['UTF-8', 'Windows-1252', 'ISO-8859-1', 'ASCII'], true);
    $needsConvert = ($fileEncoding && $fileEncoding !== 'UTF-8' && $fileEncoding !== 'ASCII');

    $allRows = [];
    while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
        if ($needsConvert) {
            $row = array_map(function($v) use ($fileEncoding) {
                return mb_convert_encoding((string)$v, 'UTF-8', $fileEncoding);
            }, $row);
        }
        $allRows[] = $row;
    }
    fclose($handle);

    if (count($allRows) < 2) {
        throw new RuntimeException('File must have at least 2 rows (header + 1 data row).');
    }

    // Detect header row: the row with more filled cells is the header
    $count0 = count(array_filter($allRows[0], function($v) { return trim((string)$v) !== ''; }));
    $count1 = isset($allRows[1]) ? count(array_filter($allRows[1], function($v) { return trim((string)$v) !== ''; })) : 0;
    $headerIdx = ($count1 > $count0) ? 1 : 0;

    // Build rawHeaders keyed by Excel-style column letter (A, B, ..., Z, AA, ...)
    $rawHeaders = [];
    foreach ($allRows[$headerIdx] as $i => $header) {
        $rawHeaders[indexToColumnLetter($i)] = trim((string)$header);
    }

    // Build parsedRows — skip empty rows
    $parsedRows = [];
    for ($r = $headerIdx + 1; $r < count($allRows); $r++) {
        $row     = $allRows[$r];
        $rowData = [];
        $isEmpty = true;
        foreach ($rawHeaders as $colLetter => $header) {
            $idx = columnLetterToIndex($colLetter);
            $val = isset($row[$idx]) ? trim((string)$row[$idx]) : '';
            $rowData[$colLetter] = $val;
            if ($val !== '') $isEmpty = false;
        }
        if (!$isEmpty) $parsedRows[] = $rowData;
    }

    return [$rawHeaders, $parsedRows];
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel parser — uses PhpSpreadsheet (PHP 8.0+ required)
// ─────────────────────────────────────────────────────────────────────────────

function parseExcelFile(string $path): array
{
    // These classes are only available after require_once autoload.php
    $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
    $sheet       = $spreadsheet->getActiveSheet();
    $highestRow  = $sheet->getHighestRow();
    $highestCol  = $sheet->getHighestColumn();

    if ($highestRow < 2) {
        throw new RuntimeException('File must have at least 2 rows (header + 1 data row).');
    }

    // Detect header row
    $row1Filled = $row2Filled = 0;
    foreach ($sheet->getColumnIterator('A', $highestCol) as $col) {
        $idx = $col->getColumnIndex();
        if (trim((string)$sheet->getCell($idx . '1')->getValue()) !== '') $row1Filled++;
        if (trim((string)$sheet->getCell($idx . '2')->getValue()) !== '') $row2Filled++;
    }
    $headerRowNum = ($row2Filled > $row1Filled) ? 2 : 1;

    // Build rawHeaders
    $rawHeaders = [];
    foreach ($sheet->getColumnIterator('A', $highestCol) as $col) {
        $idx = $col->getColumnIndex();
        $rawHeaders[$idx] = trim((string)$sheet->getCell($idx . $headerRowNum)->getValue());
    }

    // Build parsedRows
    $parsedRows = [];
    for ($r = $headerRowNum + 1; $r <= $highestRow; $r++) {
        $rowData = [];
        $isEmpty = true;
        foreach ($rawHeaders as $colLetter => $header) {
            $val = excelCellValue($sheet->getCell($colLetter . $r));
            $rowData[$colLetter] = $val;
            if ($val !== '') $isEmpty = false;
        }
        if (!$isEmpty) $parsedRows[] = $rowData;
    }

    return [$rawHeaders, $parsedRows];
}

function excelCellValue($cell): string
{
    $value = $cell->getValue();
    if ($value === null) return '';

    if ($cell->getDataType() === \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_FORMULA) {
        try { $value = $cell->getCalculatedValue(); }
        catch (Throwable $e) { $value = $cell->getOldCalculatedValue(); }
    }

    if ((is_float($value) || is_int($value)) &&
        \PhpOffice\PhpSpreadsheet\Shared\Date::isDateTime($cell)) {
        try {
            return \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float)$value)
                ->format('Y-m-d');
        } catch (Throwable $e) {}
    }

    return trim((string)$value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Column letter ↔ index helpers  (A=0, B=1, ..., Z=25, AA=26, ...)
// ─────────────────────────────────────────────────────────────────────────────

function indexToColumnLetter(int $index): string
{
    $letter = '';
    $n      = $index;
    do {
        $letter = chr(65 + ($n % 26)) . $letter;
        $n      = intdiv($n, 26) - 1;
    } while ($n >= 0);
    return $letter;
}

function columnLetterToIndex(string $letter): int
{
    $letter = strtoupper($letter);
    $index  = 0;
    for ($i = 0; $i < strlen($letter); $i++) {
        $index = $index * 26 + (ord($letter[$i]) - 64);
    }
    return $index - 1;
}
