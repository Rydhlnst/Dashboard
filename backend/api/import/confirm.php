<?php
/**
 * POST /api/import/confirm.php
 *
 * Inserts (or updates) project_records from validated staging rows.
 * Error rows are always skipped.
 * Warning rows are included only when include_warnings=true.
 *
 * Body: { batch_id: int, include_warnings: bool }
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
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

// Columns that map directly to project_records DB columns
const PR_COLUMNS = [
    'dataset_type','import_batch_id',
    'pdid','po_year','caid','scarlett_ioms_id_before','scarlett_ioms_id_final',
    'status_po','pono_tsel','capex','band','sector','project_category','sow_actual',
    'vendor_principle','siteid_po','siteid_act','neid_act','site_name','infra_type',
    'lat','lng','city','province','nop','tp_detail',
    'progress_done_flag','rfs_actual','rfs_month','mitra_impl','progress_act',
    'issue_category','notes_progress','gap_analysis','blocking','support_needed',
    'pic_blocking','detail_pic_blocking','gap_closing','current_position',
    'status_project','progress_closing','sub_progress_closing',
    'atp_status','atp_blocking','atp_tagging_plan_ori','atp_tagging_replan','atp_tagging_done','atp_approved',
    'lv_status','lv_blocking','elv_plan_ori','elv_replan','elv_approved',
    'oac_status','oac_blocking','oac_plan_ori','oac_replan','oac_approved',
    'qc_status','qc_blocking','qc_plan_ori','qc_replan','qc_sign',
    'sqac_status','sqac_blocking','sqac_plan_ori','sqac_replan','sqac_approved',
    'baut_status','baut_blocking','baut_plan_ori','baut_replan','baut_approved',
    'bast_status','bast_blocking','bast_plan_ori','bast_replan','bast_approved',
    'price_po','price_po_to_be_claim','price_bast','remaining_po','price_po_presales',
    'wbs_level3','network_number','cid1','cid1_price_bast','cid1_creation_date','cid1_approve_date',
    'cid2','cid2_price_bast','cid2_creation_date','cid2_approve_date',
    'remarks_sow','replan_rfs','plan_po','released_po',
    'custom_fields','created_by','updated_by',
];

$PR_COLUMN_SET = array_flip(PR_COLUMNS);

try {
    set_time_limit(300);
    $db = getDB();

    // ── Load batch ────────────────────────────────────────────────────────
    $bStmt = $db->prepare("SELECT * FROM import_batches WHERE id=? LIMIT 1");
    $bStmt->execute([$batchId]);
    $batch = $bStmt->fetch(PDO::FETCH_ASSOC);

    if (!$batch) jsonError("Batch #{$batchId} not found.", 404);
    if ($batch['batch_status'] !== 'validated') {
        jsonError("Batch must be in 'validated' state. Current: '{$batch['batch_status']}'.", 409);
    }

    $datasetType = $batch['dataset_type'];

    // ── Select staging rows to import ─────────────────────────────────────
    $statusList  = $includeWarnings ? ['valid','warning'] : ['valid'];
    $placeholders = implode(',', array_fill(0, count($statusList), '?'));
    $sStmt = $db->prepare(
        "SELECT id, cleaned_data FROM import_staging
          WHERE batch_id=? AND status IN ({$placeholders})
          ORDER BY `row_number` ASC"
    );
    $sStmt->execute(array_merge([$batchId], $statusList));

    $db->beginTransaction();

    $imported = 0;
    $updated  = 0;
    $skipped  = 0;

    while ($row = $sStmt->fetch(PDO::FETCH_ASSOC)) {
        $cleaned = json_decode($row['cleaned_data'] ?? '{}', true) ?? [];
        if (empty($cleaned['pdid'])) { $skipped++; continue; }

        // Build record
        $record = ['dataset_type' => $datasetType, 'import_batch_id' => $batchId,
                   'created_by' => $admin['id'], 'updated_by' => $admin['id']];
        $customFields = [];

        foreach ($cleaned as $key => $val) {
            if ($val === null || $val === '') continue;
            if (isset($PR_COLUMN_SET[$key])) {
                $record[$key] = $val;
            } else {
                $customFields[$key] = $val;
            }
        }
        if (!empty($customFields)) {
            $record['custom_fields'] = json_encode($customFields, JSON_UNESCAPED_UNICODE);
        }

        // Check if record exists (upsert)
        $checkStmt = $db->prepare(
            "SELECT id FROM project_records WHERE dataset_type=? AND pdid=? AND deleted_at IS NULL LIMIT 1"
        );
        $checkStmt->execute([$datasetType, $cleaned['pdid']]);
        $existing = $checkStmt->fetchColumn();

        if ($existing) {
            // UPDATE existing
            unset($record['created_by']); // keep original creator
            $record['updated_at'] = date('Y-m-d H:i:s');
            $sets = implode(', ', array_map(fn($k) => "`{$k}`=?", array_keys($record)));
            $vals = array_values($record);
            $vals[] = (int)$existing;
            $db->prepare("UPDATE project_records SET {$sets} WHERE id=?")->execute($vals);
            $updated++;
        } else {
            // INSERT new
            $record['created_at'] = $record['updated_at'] = date('Y-m-d H:i:s');
            $cols = implode(', ', array_map(fn($k) => "`{$k}`", array_keys($record)));
            $plhs = implode(', ', array_fill(0, count($record), '?'));
            $db->prepare("INSERT INTO project_records ({$cols}) VALUES ({$plhs})")
               ->execute(array_values($record));
            $imported++;
        }

        // Mark staging row as imported
        $db->prepare("UPDATE import_staging SET status='imported', imported_at=NOW() WHERE id=?")
           ->execute([(int)$row['id']]);
    }

    $db->commit();

    // Update batch
    $db->prepare(
        "UPDATE import_batches
            SET imported_rows=?, batch_status='completed'
          WHERE id=?"
    )->execute([$imported + $updated, $batchId]);

    AuditLog::log(
        $admin['id'], 'import', 'import_batch', (string)$batchId,
        "Confirmed import batch #{$batchId}: {$imported} new, {$updated} updated, {$skipped} skipped — dataset={$datasetType}"
    );

    jsonSuccess([
        'batch_id'        => $batchId,
        'dataset_type'    => $datasetType,
        'inserted'        => $imported,
        'updated'         => $updated,
        'skipped'         => $skipped,
        'total_imported'  => $imported + $updated,
        'include_warnings'=> $includeWarnings,
    ], "{$imported} new records inserted, {$updated} updated.");

} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    jsonError('Import failed: ' . $e->getMessage(), 500);
}
