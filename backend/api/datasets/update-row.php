<?php
/**
 * POST /api/datasets/update-row.php
 *
 * Update a single row in a dynamic ds_* table.
 *
 * JSON body:
 *   dataset_id : int                 required
 *   row_id     : int                 required — matches _id in ds_* table
 *   values     : { col_name: value } required — only whitelisted schema columns applied
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/schema_builder.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

requireAdmin();

$body      = getRequestBody();
$datasetId = (int)($body['dataset_id'] ?? 0);
$rowId     = (int)($body['row_id']     ?? 0);
$values    = isset($body['values']) && is_array($body['values']) ? $body['values'] : [];

if ($datasetId <= 0) jsonError('dataset_id is required.', 400);
if ($rowId     <= 0) jsonError('row_id is required.', 400);
if (empty($values))  jsonError('values is required.', 400);

try {
    $db = getDB();

    $dStmt = $db->prepare("SELECT table_name, columns_schema FROM datasets WHERE id=? LIMIT 1");
    $dStmt->execute([$datasetId]);
    $dataset = $dStmt->fetch(PDO::FETCH_ASSOC);
    if (!$dataset) jsonError("Dataset #{$datasetId} not found.", 404);

    $tableName = $dataset['table_name'];
    if (!preg_match('/^ds_[a-z0-9_]+$/', $tableName)) {
        jsonError("Unsafe table name '{$tableName}'.", 500);
    }

    $schema     = json_decode($dataset['columns_schema'] ?? '[]', true) ?? [];
    $colTypeMap = [];
    foreach ($schema as $col) {
        $cn = $col['col_name'] ?? '';
        if ($cn !== '' && !in_array($cn, DS_RESERVED_COLS, true)) {
            $colTypeMap[$cn] = $col['col_type'] ?? 'VARCHAR(255)';
        }
    }

    // Whitelist + build SET clause
    $setParts = [];
    $params   = [];
    foreach ($values as $colName => $rawVal) {
        $safe = sanitizeColName((string)$colName);
        if (!isset($colTypeMap[$safe])) continue;

        $setParts[] = "`{$safe}` = ?";
        // Empty string → NULL to keep type-cleanliness
        $v = is_string($rawVal) ? trim($rawVal) : $rawVal;
        $params[] = ($v === '' || $v === null) ? null : $v;
    }

    if (empty($setParts)) {
        jsonError('No valid columns to update.', 400);
    }

    $params[] = $rowId;

    $sql  = "UPDATE `{$tableName}` SET " . implode(', ', $setParts) . " WHERE `_id` = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        // Row exists but nothing changed, OR row not found. Check.
        $chk = $db->prepare("SELECT 1 FROM `{$tableName}` WHERE `_id` = ? LIMIT 1");
        $chk->execute([$rowId]);
        if (!$chk->fetch()) jsonError('Row not found.', 404);
    }

    // Return the updated row
    $rStmt = $db->prepare("SELECT * FROM `{$tableName}` WHERE `_id` = ? LIMIT 1");
    $rStmt->execute([$rowId]);
    $row = $rStmt->fetch(PDO::FETCH_ASSOC);

    jsonSuccess(['row' => $row], 'Row updated.');

} catch (Throwable $e) {
    jsonError('Update failed: ' . $e->getMessage(), 500);
}
