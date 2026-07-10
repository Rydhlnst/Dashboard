<?php
/**
 * POST /api/import/upload.php
 *
 * Accepts a file upload (CSV or Excel), auto-detects column schema,
 * creates or extends a dynamic ds_* table, inserts rows into import_staging.
 *
 * POST body (multipart/form-data):
 *   file            : File  (required)
 *   dataset_name    : string  required when creating a new dataset
 *   dataset_id      : int     optional — re-import into an existing dataset
 *   primary_key_col : string  optional — column for upsert deduplication (new datasets only)
 *
 * CSV  → parsed with native fgetcsv() (any PHP version)
 * XLSX → parsed with PhpSpreadsheet (PHP 8.0+ only)
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../helpers/upload.php';
require_once __DIR__ . '/../../helpers/schema_builder.php';  // column letters, names, types, DDL

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

$datasetName   = trim($_POST['dataset_name']    ?? '');
$datasetId     = (int)($_POST['dataset_id']     ?? 0);
$primaryKeyCol = trim($_POST['primary_key_col'] ?? '');

if ($datasetName === '' && $datasetId <= 0) {
    jsonError('dataset_name is required when creating a new dataset.', 400);
}

$tmpPath = null;
try {
    set_time_limit(180);

    $tmpPath  = moveUploadToTemp($file);
    $fileName = basename($file['name']);
    $ext      = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

    // ── Parse file → $rawHeaders, $parsedRows ────────────────────────────────
    // rawHeaders : ['A' => 'Header Text', 'B' => 'Header2', …]
    // parsedRows : [['A' => 'val', …], …]  empty rows excluded

    if ($ext === 'csv') {
        [$rawHeaders, $parsedRows] = parseCsvFile($tmpPath);
    } else {
        $autoload = __DIR__ . '/../../vendor/autoload.php';
        if (!file_exists($autoload)) {
            cleanupTempFile($tmpPath);
            jsonError('PhpSpreadsheet not installed. Upload a CSV instead or run: composer install', 500);
        }
        if (PHP_MAJOR_VERSION < 8) {
            cleanupTempFile($tmpPath);
            jsonError('Excel upload requires PHP 8.0+. Please upload a CSV file instead.', 500);
        }
        require_once $autoload;
        [$rawHeaders, $parsedRows] = parseExcelFile($tmpPath);
    }

    if (empty($rawHeaders) || empty($parsedRows)) {
        cleanupTempFile($tmpPath);
        jsonError('File must have at least one header row and one data row.', 422);
    }

    // ── Build column name map + infer types ───────────────────────────────────
    $headerIndexed = array_values($rawHeaders);         // 0-indexed
    $colNameMap    = buildColumnMap($headerIndexed);    // col_letter => col_name|null

    // Collect up to 100 sample values per column for type inference
    $samples = [];
    $sampleLimit = min(100, count($parsedRows));
    foreach (array_slice($parsedRows, 0, $sampleLimit) as $row) {
        foreach ($rawHeaders as $letter => $header) {
            if ($header === '') continue;
            $samples[$letter][] = $row[$letter] ?? '';
        }
    }

    // Build columns definition array
    $columnDefs = [];   // [{col_name, col_type, label}, …]
    foreach ($rawHeaders as $letter => $header) {
        if ($header === '') continue;
        $colName = $colNameMap[$letter] ?? null;
        if ($colName === null) continue;
        $colType = inferColType($samples[$letter] ?? []);
        $columnDefs[] = [
            'col_name' => $colName,
            'col_type' => $colType,
            'label'    => $header,
        ];
    }

    // ── Get or create the dataset + ds_* table ────────────────────────────────
    $db            = getDB();
    $isNewDataset  = false;
    $newColumns    = [];

    if ($datasetId > 0) {
        // ── Re-import into existing dataset ────────────────────────────────
        $dStmt = $db->prepare("SELECT * FROM datasets WHERE id=? LIMIT 1");
        $dStmt->execute([$datasetId]);
        $dataset = $dStmt->fetch(PDO::FETCH_ASSOC);
        if (!$dataset) {
            cleanupTempFile($tmpPath);
            jsonError("Dataset #{$datasetId} not found.", 404);
        }

        $tableName      = $dataset['table_name'];
        $datasetName    = $dataset['name'];
        $existingSchema = json_decode($dataset['columns_schema'], true) ?? [];
        $primaryKeyCol  = $dataset['primary_key_col'] ?? '';

        // Find columns in this file that are not in the existing schema
        $newColumns = findNewColumns($columnDefs, $existingSchema);
        if (!empty($newColumns)) {
            alterDatasetTable($db, $tableName, $newColumns);
            $mergedSchema = array_merge($existingSchema, $newColumns);
            $db->prepare(
                "UPDATE datasets SET columns_schema=?, updated_at=NOW() WHERE id=?"
            )->execute([
                json_encode($mergedSchema, JSON_UNESCAPED_UNICODE),
                $datasetId,
            ]);
        }

    } else {
        // ── Create new dataset ─────────────────────────────────────────────
        $isNewDataset = true;
        $tableName    = buildTableName($datasetName);
        $slug         = slugifyDatasetName($datasetName);

        // Ensure table name / slug uniqueness
        $checkStmt = $db->prepare("SELECT id FROM datasets WHERE table_name=? OR slug=? LIMIT 1");
        $checkStmt->execute([$tableName, $slug]);
        if ($checkStmt->fetch()) {
            // Collision: append counter
            $base     = $tableName;
            $baseSlug = $slug;
            for ($i = 2; $i <= 99; $i++) {
                $tableName = $base . '_' . $i;
                $slug      = $baseSlug . '_' . $i;
                $checkStmt->execute([$tableName, $slug]);
                if (!$checkStmt->fetch()) break;
            }
        }

        createDatasetTable($db, $tableName, $columnDefs);

        $db->prepare(
            "INSERT INTO datasets (name, slug, table_name, columns_schema, primary_key_col, created_by)
             VALUES (?, ?, ?, ?, ?, ?)"
        )->execute([
            $datasetName,
            $slug,
            $tableName,
            json_encode($columnDefs, JSON_UNESCAPED_UNICODE),
            $primaryKeyCol ?: null,
            $admin['id'],
        ]);
        $datasetId = (int)$db->lastInsertId();
    }

    // ── Build column header → col_name map for staging (stored on batch) ─────
    $columnMap = [];   // {header_label: col_name}
    foreach ($columnDefs as $col) {
        $columnMap[$col['label']] = $col['col_name'];
    }

    // ── Build preview rows (first 10) ─────────────────────────────────────────
    $previewRows = [];
    foreach (array_slice($parsedRows, 0, 10) as $row) {
        $previewRow = [];
        foreach ($rawHeaders as $letter => $header) {
            if ($header === '') continue;
            $colName = $colNameMap[$letter] ?? null;
            if ($colName === null) continue;
            $previewRow[$colName] = $row[$letter] ?? '';
        }
        $previewRows[] = $previewRow;
    }

    $totalRows = count($parsedRows);

    // ── Create import_batch ───────────────────────────────────────────────────
    $db->prepare(
        "INSERT INTO import_batches
           (dataset_id, file_name, dataset_type, column_map, unknown_columns,
            total_rows, imported_by, imported_at, batch_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'uploading')"
    )->execute([
        $datasetId,
        $fileName,
        $datasetName,     // human-readable name stored in dataset_type for display
        json_encode($columnMap,  JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
        json_encode([], JSON_UNESCAPED_UNICODE),   // no unknown columns in dynamic system
        $totalRows,
        $admin['id'],
    ]);
    $batchId = (int)$db->lastInsertId();

    // ── Batch-insert staging rows ─────────────────────────────────────────────
    // raw_data is stored as {col_name: raw_value} (not header → value)
    $insertSql = "INSERT INTO import_staging (batch_id, `row_number`, raw_data, status) VALUES ";
    $chunk     = [];
    $params    = [];
    $rowNum    = 2;   // row 1 = header row

    foreach ($parsedRows as $row) {
        $rowData = [];
        foreach ($rawHeaders as $letter => $header) {
            if ($header === '') continue;
            $colName = $colNameMap[$letter] ?? null;
            if ($colName === null) continue;
            $rowData[$colName] = $row[$letter] ?? '';
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
        'batch_id'       => $batchId,
        'file_name'      => $fileName,
        'dataset_id'     => $datasetId,
        'dataset_name'   => $datasetName,
        'is_new_dataset' => $isNewDataset,
        'total_rows'     => $totalRows,
        'columns'        => $columnDefs,
        'new_columns'    => $newColumns,
        'preview_rows'   => $previewRows,
    ], 'File uploaded. Proceed to validation.');

} catch (Throwable $e) {
    if ($tmpPath) cleanupTempFile($tmpPath);
    jsonError('Upload failed: ' . $e->getMessage(), 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV parser — native PHP, no dependencies
// ─────────────────────────────────────────────────────────────────────────────

function parseCsvFile(string $path): array
{
    $handle = fopen($path, 'r');
    if ($handle === false) throw new RuntimeException('Cannot open CSV file.');

    // Strip UTF-8 BOM
    $bom = fread($handle, 3);
    if ($bom !== "\xEF\xBB\xBF") rewind($handle);

    // Detect delimiter
    $sample    = fgets($handle);
    rewind($handle);
    if ($bom === "\xEF\xBB\xBF") fread($handle, 3);
    $comma     = substr_count($sample, ',');
    $semicolon = substr_count($sample, ';');
    $tab       = substr_count($sample, "\t");
    $delimiter = ',';
    if ($semicolon > $comma && $semicolon > $tab) $delimiter = ';';
    elseif ($tab > $comma && $tab > $semicolon)   $delimiter = "\t";

    // Detect encoding
    $encodingSample = fread($handle, 4096);
    rewind($handle);
    if ($bom === "\xEF\xBB\xBF") fread($handle, 3);
    $fileEncoding = mb_detect_encoding($encodingSample, ['UTF-8','Windows-1252','ISO-8859-1','ASCII'], true);
    $needsConvert = ($fileEncoding && $fileEncoding !== 'UTF-8' && $fileEncoding !== 'ASCII');

    $allRows = [];
    while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
        if ($needsConvert) {
            $row = array_map(function ($v) use ($fileEncoding) {
                return mb_convert_encoding((string)$v, 'UTF-8', $fileEncoding);
            }, $row);
        }
        $allRows[] = $row;
    }
    fclose($handle);

    if (count($allRows) < 2) {
        throw new RuntimeException('File must have at least 2 rows (header + 1 data row).');
    }

    // Detect header row (the one with more filled cells is the header)
    $count0    = count(array_filter($allRows[0], function ($v) { return trim((string)$v) !== ''; }));
    $count1    = isset($allRows[1]) ? count(array_filter($allRows[1], function ($v) { return trim((string)$v) !== ''; })) : 0;
    $headerIdx = ($count1 > $count0) ? 1 : 0;

    $rawHeaders = [];
    foreach ($allRows[$headerIdx] as $i => $header) {
        $rawHeaders[indexToColumnLetter($i)] = trim((string)$header);
    }

    $parsedRows = [];
    for ($r = $headerIdx + 1, $total = count($allRows); $r < $total; $r++) {
        $row     = $allRows[$r];
        $rowData = [];
        $isEmpty = true;
        foreach ($rawHeaders as $letter => $header) {
            $idx  = columnLetterToIndex($letter);
            $val  = isset($row[$idx]) ? trim((string)$row[$idx]) : '';
            $rowData[$letter] = $val;
            if ($val !== '') $isEmpty = false;
        }
        if (!$isEmpty) $parsedRows[] = $rowData;
    }

    return [$rawHeaders, $parsedRows];
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel parser — PhpSpreadsheet (PHP 8.0+ only)
// ─────────────────────────────────────────────────────────────────────────────

function parseExcelFile(string $path): array
{
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

    $rawHeaders = [];
    foreach ($sheet->getColumnIterator('A', $highestCol) as $col) {
        $idx = $col->getColumnIndex();
        $rawHeaders[$idx] = trim((string)$sheet->getCell($idx . $headerRowNum)->getValue());
    }

    $parsedRows = [];
    for ($r = $headerRowNum + 1; $r <= $highestRow; $r++) {
        $rowData = [];
        $isEmpty = true;
        foreach ($rawHeaders as $letter => $header) {
            $val = excelCellValue($sheet->getCell($letter . $r));
            $rowData[$letter] = $val;
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
