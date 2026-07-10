<?php
/**
 * POST /api/import/confirm.php
 *
 * Inserts (or upserts) rows from validated staging into the dynamic ds_* table.
 * Error rows are always skipped. Warning rows included when include_warnings=true.
 *
 * Body: { batch_id: int, include_warnings: bool }
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

$batchId         = (int)($body['batch_id']         ?? 0);
$includeWarnings = (bool)($body['include_warnings'] ?? false);

if ($batchId <= 0) jsonError('batch_id is required.', 400);

try {
    set_time_limit(300);
    $db = getDB();

    // ── Load batch + dataset info ─────────────────────────────────────────────
    $bStmt = $db->prepare(
        "SELECT ib.*, d.table_name, d.columns_schema, d.primary_key_col
           FROM import_batches ib
           JOIN datasets d ON d.id = ib.dataset_id
          WHERE ib.id = ? LIMIT 1"
    );
    $bStmt->execute([$batchId]);
    $batch = $bStmt->fetch(PDO::FETCH_ASSOC);

    if (!$batch)  jsonError("Batch #{$batchId} not found.", 404);
    if ($batch['batch_status'] !== 'validated') {
        jsonError("Batch must be 'validated'. Current: '{$batch['batch_status']}'.", 409);
    }

    $tableName     = $batch['table_name'];
    $primaryKeyCol = $batch['primary_key_col'] ?? null;
    $datasetId     = (int)$batch['dataset_id'];
    $schema        = json_decode($batch['columns_schema'] ?? '[]', true) ?? [];

    // Sanitised column names from schema (trusted — already sanitised at upload)
    $colNames = [];
    foreach ($schema as $col) {
        $safe = sanitizeColName($col['col_name']);
        if ($safe !== '') $colNames[] = $safe;
    }

    // Build col list and placeholder list (exclude meta-columns; add _batch_id)
    $insertColNames   = $colNames;
    $insertColNames[] = '_batch_id';

    $colList = implode(', ', array_map(function ($c) { return "`{$c}`"; }, $insertColNames));
    $phList  = implode(', ', array_fill(0, count($insertColNames), '?'));

    // ── Select staging rows ───────────────────────────────────────────────────
    $statusList   = $includeWarnings ? ['valid','warning'] : ['valid'];
    $placeholders = implode(',', array_fill(0, count($statusList), '?'));
    $sStmt = $db->prepare(
        "SELECT id, cleaned_data FROM import_staging
          WHERE batch_id=? AND status IN ({$placeholders})
          ORDER BY `row_number` ASC"
    );
    $sStmt->execute(array_merge([$batchId], $statusList));

    $db->beginTransaction();

    $inserted = 0;
    $updated  = 0;
    $skipped  = 0;

    // Prepare the staging-row mark-as-imported statement once (not per row)
    $markImportedStmt = $db->prepare(
        "UPDATE import_staging SET status='imported', imported_at=NOW() WHERE id=?"
    );

    // Prepare statements (only if we actually have columns)
    $insertStmt = $db->prepare(
        "INSERT INTO `{$tableName}` ({$colList}) VALUES ({$phList})"
    );

    $checkStmt  = null;
    $updateStmt = null;
    if ($primaryKeyCol) {
        $safePk    = sanitizeColName($primaryKeyCol);
        $checkStmt = $db->prepare(
            "SELECT `_id` FROM `{$tableName}` WHERE `{$safePk}`=? LIMIT 1"
        );
        // Build UPDATE set: all cols except PK and _batch_id
        $updateCols = array_filter($insertColNames, function ($c) use ($safePk) {
            return $c !== $safePk;
        });
        if (!empty($updateCols)) {
            $setClause  = implode(', ', array_map(function ($c) { return "`{$c}`=?"; }, $updateCols));
            $updateStmt = $db->prepare(
                "UPDATE `{$tableName}` SET {$setClause} WHERE `_id`=?"
            );
        }
    }

    while ($row = $sStmt->fetch(PDO::FETCH_ASSOC)) {
        $cleaned = json_decode($row['cleaned_data'] ?? '{}', true) ?? [];

        // Build ordered values for INSERT (cols + _batch_id)
        $insertVals = [];
        foreach ($colNames as $col) {
            $insertVals[] = $cleaned[$col] ?? null;
        }
        $insertVals[] = $batchId;   // _batch_id

        if ($primaryKeyCol && $checkStmt) {
            $safePk  = sanitizeColName($primaryKeyCol);
            $pkValue = $cleaned[$safePk] ?? null;

            if ($pkValue === null) {
                // No PK value — always insert
                $insertStmt->execute($insertVals);
                $inserted++;
            } else {
                $checkStmt->execute([$pkValue]);
                $existingId = $checkStmt->fetchColumn();

                if ($existingId && $updateStmt) {
                    // UPDATE existing: values for all cols except PK, then _id
                    $updateCols = array_filter($insertColNames, function ($c) use ($safePk) {
                        return $c !== $safePk;
                    });
                    $updateVals = [];
                    foreach ($updateCols as $col) {
                        if ($col === '_batch_id') {
                            $updateVals[] = $batchId;
                        } else {
                            $updateVals[] = $cleaned[$col] ?? null;
                        }
                    }
                    $updateVals[] = (int)$existingId;
                    $updateStmt->execute($updateVals);
                    $updated++;
                } else {
                    $insertStmt->execute($insertVals);
                    $inserted++;
                }
            }
        } else {
            $insertStmt->execute($insertVals);
            $inserted++;
        }

        $markImportedStmt->execute([(int)$row['id']]);
    }

    $db->commit();

    // ── Update counters ───────────────────────────────────────────────────────
    $totalImported = $inserted + $updated;

    $db->prepare(
        "UPDATE import_batches SET imported_rows=?, batch_status='completed' WHERE id=?"
    )->execute([$totalImported, $batchId]);

    // Refresh cached row_count in datasets table
    $db->prepare(
        "UPDATE datasets SET row_count=(SELECT COUNT(*) FROM `{$tableName}`), updated_at=NOW() WHERE id=?"
    )->execute([$datasetId]);

    AuditLog::log(
        $admin['id'], 'import', 'import_batch', (string)$batchId,
        "Confirmed import batch #{$batchId} → {$tableName}: {$inserted} inserted, {$updated} updated, {$skipped} skipped"
    );

    jsonSuccess([
        'batch_id'         => $batchId,
        'dataset_id'       => $datasetId,
        'table_name'       => $tableName,
        'inserted'         => $inserted,
        'updated'          => $updated,
        'skipped'          => $skipped,
        'total_imported'   => $totalImported,
        'include_warnings' => $includeWarnings,
    ], "{$inserted} rows inserted, {$updated} updated.");

} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    jsonError('Import failed: ' . $e->getMessage(), 500);
}
