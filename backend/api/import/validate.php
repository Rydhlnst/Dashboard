<?php
/**
 * POST /api/import/validate.php
 *
 * Type-based validation for the dynamic import pipeline.
 * No column mapping step needed — mapping was done at upload time.
 *
 * Body: { batch_id: int }
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/schema_builder.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();
$body  = getRequestBody();

$batchId = (int)($body['batch_id'] ?? 0);
if ($batchId <= 0) jsonError('batch_id is required.', 400);

try {
    set_time_limit(300);
    $db = getDB();

    // ── Load batch ────────────────────────────────────────────────────────────
    $bStmt = $db->prepare(
        "SELECT ib.*, d.columns_schema, d.table_name, d.primary_key_col
           FROM import_batches ib
           LEFT JOIN datasets d ON d.id = ib.dataset_id
          WHERE ib.id = ? LIMIT 1"
    );
    $bStmt->execute([$batchId]);
    $batch = $bStmt->fetch(PDO::FETCH_ASSOC);

    if (!$batch) jsonError("Batch #{$batchId} not found.", 404);
    if (!in_array($batch['batch_status'], ['pending_validation','validated'], true)) {
        jsonError("Batch status '{$batch['batch_status']}' cannot be validated.", 409);
    }
    if (empty($batch['dataset_id'])) {
        jsonError("Batch #{$batchId} has no linked dataset. Use the legacy validate endpoint.", 409);
    }

    // ── Build type map from columns_schema ────────────────────────────────────
    $schema  = json_decode($batch['columns_schema'] ?? '[]', true) ?? [];
    $typeMap = [];      // col_name => col_type
    foreach ($schema as $col) {
        $typeMap[$col['col_name']] = $col['col_type'];
    }

    $primaryKeyCol = $batch['primary_key_col'] ?? null;
    $tableName     = $batch['table_name']      ?? null;

    // ── Load existing primary-key values from ds_* table (for dedup) ─────────
    $dbPkValues = [];
    if ($primaryKeyCol && $tableName) {
        $safePk = sanitizeColName($primaryKeyCol);
        $pkStmt = $db->query("SELECT UPPER(`{$safePk}`) AS pk FROM `{$tableName}`");
        while ($pkRow = $pkStmt->fetch(PDO::FETCH_ASSOC)) {
            if ($pkRow['pk'] !== null) $dbPkValues[strtoupper((string)$pkRow['pk'])] = true;
        }
    }

    // ── Process all staging rows ──────────────────────────────────────────────
    $stagingStmt = $db->prepare(
        "SELECT id, `row_number`, raw_data FROM import_staging WHERE batch_id=? ORDER BY `row_number` ASC"
    );
    $stagingStmt->execute([$batchId]);

    $updateStmt = $db->prepare(
        "UPDATE import_staging
            SET mapped_data=?, cleaned_data=?, status=?, validation_errors=?, validation_warnings=?
          WHERE id=?"
    );

    $counts      = ['valid' => 0, 'warning' => 0, 'error' => 0];
    $batchPkSeen = [];   // track PK values within this batch

    while ($row = $stagingStmt->fetch(PDO::FETCH_ASSOC)) {
        $rawData  = json_decode($row['raw_data'] ?? '{}', true) ?? [];
        $cleaned  = [];
        $errors   = [];
        $warnings = [];

        // ── Clean every column by its inferred type ───────────────────────
        foreach ($rawData as $colName => $rawVal) {
            $colType = $typeMap[$colName] ?? 'VARCHAR(255)';
            [$cleanedVal, $colWarns, $colErrors] = cleanValueByType((string)$rawVal, $colType);
            $cleaned[$colName] = $cleanedVal;
            foreach ($colWarns   as $msg) $warnings[] = ['field' => $colName, 'message' => $msg];
            foreach ($colErrors  as $msg) $errors[]   = ['field' => $colName, 'message' => $msg];
        }

        // ── Primary key duplicate detection ───────────────────────────────
        // $primaryKeyCol is stored as the raw user input (e.g. "PDID").
        // Cleaned data keys are sanitised col_names (e.g. "pdid").
        // Must use sanitizeColName() to match the correct key.
        if ($primaryKeyCol) {
            $safePkName = sanitizeColName($primaryKeyCol);
            if (isset($cleaned[$safePkName])) {
                $pkVal = strtoupper((string)($cleaned[$safePkName] ?? ''));
                if ($pkVal !== '') {
                    if (isset($batchPkSeen[$pkVal])) {
                        $errors[] = [
                            'field'   => $safePkName,
                            'message' => "Duplicate key '{$cleaned[$safePkName]}' within this file — only the first occurrence will be imported.",
                        ];
                    } else {
                        $batchPkSeen[$pkVal] = true;
                        if (isset($dbPkValues[$pkVal])) {
                            $warnings[] = [
                                'field'   => $safePkName,
                                'message' => "Key '{$cleaned[$safePkName]}' already exists — record will be updated.",
                            ];
                        }
                    }
                }
            }
        }

        // ── Determine row status ──────────────────────────────────────────
        if (!empty($errors))        $status = 'error';
        elseif (!empty($warnings))  $status = 'warning';
        else                        $status = 'valid';

        $counts[$status] = ($counts[$status] ?? 0) + 1;

        $updateStmt->execute([
            json_encode($rawData,   JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
            json_encode($cleaned,   JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
            $status,
            json_encode($errors,    JSON_UNESCAPED_UNICODE),
            json_encode($warnings,  JSON_UNESCAPED_UNICODE),
            (int)$row['id'],
        ]);
    }

    // ── Update batch counters ─────────────────────────────────────────────────
    $db->prepare(
        "UPDATE import_batches
            SET valid_rows=?, warning_rows=?, error_rows=?, batch_status='validated'
          WHERE id=?"
    )->execute([$counts['valid'], $counts['warning'], $counts['error'], $batchId]);

    AuditLog::log(
        $admin['id'], 'validate_import', 'import_batch', (string)$batchId,
        "Validated batch #{$batchId}: {$counts['valid']} valid, {$counts['warning']} warning, {$counts['error']} error"
    );

    jsonSuccess([
        'batch_id'     => $batchId,
        'dataset_id'   => (int)$batch['dataset_id'],
        'total'        => array_sum($counts),
        'valid'        => $counts['valid'],
        'warning'      => $counts['warning'],
        'error'        => $counts['error'],
    ], 'Validation complete.');

} catch (Throwable $e) {
    jsonError('Validation failed: ' . $e->getMessage(), 500);
}
