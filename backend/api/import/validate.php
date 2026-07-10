<?php
/**
 * POST /api/import/validate.php
 *
 * Applies column mapping, cleans data, and validates every staging row
 * for a given batch. Returns a summary — no data enters project_records.
 *
 * Body: {
 *   batch_id: int,
 *   column_actions: {
 *     "<col_letter>": { action: "create"|"map"|"ignore", field_key: string }
 *   }
 * }
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/column_map.php';
require_once __DIR__ . '/../../helpers/data_cleaner.php';
require_once __DIR__ . '/../../helpers/validator.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();
$body  = getRequestBody();

$batchId    = (int)($body['batch_id'] ?? 0);
$colActions = (array)($body['column_actions'] ?? []);  // {colLetter: {action, field_key}}

if ($batchId <= 0) jsonError('batch_id is required.', 400);

try {
    set_time_limit(300);
    $db = getDB();

    // ── Load batch ────────────────────────────────────────────────────────
    $batch = $db->prepare("SELECT * FROM import_batches WHERE id=? LIMIT 1");
    $batch->execute([$batchId]);
    $batch = $batch->fetch(PDO::FETCH_ASSOC);

    if (!$batch) jsonError("Batch #{$batchId} not found.", 404);
    if (!in_array($batch['batch_status'], ['pending_validation','validated'], true)) {
        jsonError("Batch status '{$batch['batch_status']}' cannot be validated.", 409);
    }

    $datasetType    = $batch['dataset_type'];
    $columnMap      = json_decode($batch['column_map'] ?? '{}', true);       // {header: db_col}
    $unknownColumns = json_decode($batch['unknown_columns'] ?? '{}', true);  // {colLetter: {header, field_key, ...}}

    // ── Apply user column_actions to build final header→field_key map ─────
    foreach ($colActions as $colLetter => $action) {
        if (!isset($unknownColumns[$colLetter])) continue;
        $header = $unknownColumns[$colLetter]['header'];

        if (in_array($action['action'] ?? '', ['create','map'], true)) {
            $fieldKey = $action['field_key'] ?? $unknownColumns[$colLetter]['field_key'];
            if ($fieldKey) $columnMap[$header] = $fieldKey;

            // Auto-create column_definition for "create" action
            if (($action['action'] ?? '') === 'create') {
                $stmt = $db->prepare(
                    "SELECT id FROM column_definitions WHERE field_key=? AND dataset_type IN ('all',?) LIMIT 1"
                );
                $stmt->execute([$fieldKey, $datasetType]);
                if (!$stmt->fetch()) {
                    $db->prepare(
                        "INSERT INTO column_definitions
                           (dataset_type, field_key, label, field_type, is_system, is_visible, sort_order, created_at, updated_at)
                         VALUES (?, ?, ?, 'text', 0, 1, 999, NOW(), NOW())"
                    )->execute([$datasetType, $fieldKey, $header]);
                    AuditLog::log(
                        $admin['id'], 'auto_create_column', 'column_definition', null,
                        "Auto-created dynamic column '{$fieldKey}' (label: {$header}) for dataset {$datasetType}"
                    );
                }
            }
        }
        // 'ignore': header not added to columnMap → values silently dropped
    }

    // ── Load existing PDIDs in DB for duplicate detection ─────────────────
    $dbPdids = loadDbPdids($db, $datasetType);

    // ── Process all pending staging rows ──────────────────────────────────
    $stagingStmt = $db->prepare(
        "SELECT id, `row_number`, raw_data FROM import_staging WHERE batch_id=? ORDER BY `row_number` ASC"
    );
    $stagingStmt->execute([$batchId]);

    $counts     = ['valid' => 0, 'warning' => 0, 'error' => 0];
    $batchPdids = [];   // track PDIDs within this batch

    // Prepare update statement (reused per row)
    $updateStmt = $db->prepare(
        "UPDATE import_staging
            SET mapped_data=?, cleaned_data=?, status=?, validation_errors=?, validation_warnings=?
          WHERE id=?"
    );

    while ($row = $stagingStmt->fetch(PDO::FETCH_ASSOC)) {
        $rawData = json_decode($row['raw_data'], true) ?? [];

        // Apply column map → {field_key: raw_value}
        $mappedData = [];
        foreach ($rawData as $header => $rawVal) {
            $fieldKey = $columnMap[$header] ?? null;
            if ($fieldKey !== null) {
                $mappedData[$fieldKey] = (string)$rawVal;
            }
        }

        // Validate + clean
        [$cleanedData, $status, $errors, $warnings] = validateRow(
            $mappedData, $datasetType, $batchPdids, $dbPdids
        );

        $counts[$status] = ($counts[$status] ?? 0) + 1;

        $updateStmt->execute([
            json_encode($mappedData,   JSON_UNESCAPED_UNICODE),
            json_encode($cleanedData,  JSON_UNESCAPED_UNICODE),
            $status,
            json_encode($errors,       JSON_UNESCAPED_UNICODE),
            json_encode($warnings,     JSON_UNESCAPED_UNICODE),
            (int)$row['id'],
        ]);
    }

    // ── Update batch counters ─────────────────────────────────────────────
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
        'dataset_type' => $datasetType,
        'total'        => array_sum($counts),
        'valid'        => $counts['valid'],
        'warning'      => $counts['warning'],
        'error'        => $counts['error'],
    ], 'Validation complete.');

} catch (Throwable $e) {
    jsonError('Validation failed: ' . $e->getMessage(), 500);
}
