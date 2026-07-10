<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();

$id = sanitizeInt($_GET['id'] ?? null);
if (!$id) {
    jsonError('Invalid or missing project ID.', 400);
}

$db   = getDB();
$stmt = $db->prepare('SELECT id FROM project_records WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
if (!$stmt->fetch()) {
    jsonError('Project not found.', 404);
}

$body   = getRequestBody();
$fields = buildUpdateFields($body);

if (empty($fields)) {
    jsonError('No valid fields to update.', 400);
}

$setClauses = implode(', ', array_map(fn($k) => "{$k} = ?", array_keys($fields)));
$values     = array_values($fields);
$values[]   = $id;

$stmt = $db->prepare("UPDATE project_records SET {$setClauses}, updated_at = NOW() WHERE id = ?");
$stmt->execute($values);

AuditLog::log($admin['id'], 'update', 'project_record', (string)$id, "Updated project record ID {$id}");

jsonSuccess(['id' => $id], 'Project updated successfully.');

function buildUpdateFields(array $body): array {
    $textCols = [
        'sow_actual', 'notes_progress', 'gap_analysis', 'support_needed', 'detail_pic_blocking',
        'gap_closing', 'remarks_sow',
        // acceptance blocking notes
        'atp_blocking','lv_blocking','oac_blocking','qc_blocking','sqac_blocking','baut_blocking','bast_blocking',
    ];

    $stringCols = [
        'pdid','caid','scarlett_ioms_id_final','scarlett_ioms_id_before','status_po','pono_tsel',
        'band','sector','project_category','vendor_principle','cr_status',
        'status_eba_mapping','eba_mapping_number','donor_act_siteid',
        'donor_nop','donor_tp','donor_progress','replan_dismantle','donor_dismantle_actual',
        'siteid_po','siteid_act','neid_act','site_name','infra_type','city','province',
        'nop','tp_detail','rfs_month','mitra_impl','progress_act','issue_category',
        'pic_blocking','current_position','status_project','progress_closing','sub_progress_closing',
        'atp_status','lv_status','oac_status','qc_status','sqac_status','baut_status','bast_status',
        'po_year','progress_done_flag',
        'wbs_level3','network_number','cid1','cid2',
    ];

    $decimalCols = [
        'capex','price_po','price_po_to_be_claim','price_bast','remaining_po',
        'price_po_presales','cid1_price_bast','cid2_price_bast','plan_po','released_po',
    ];

    $dateCols = [
        'rfs_actual','replan_rfs',
        'atp_tagging_plan_ori','atp_tagging_replan','atp_tagging_done','atp_approved',
        'elv_plan_ori','elv_replan','elv_approved',
        'oac_plan_ori','oac_replan','oac_approved',
        'qc_plan_ori','qc_replan','qc_sign',
        'sqac_plan_ori','sqac_replan','sqac_approved',
        'baut_plan_ori','baut_replan','baut_approved',
        'bast_plan_ori','bast_replan','bast_approved',
        'cid1_creation_date','cid1_approve_date',
        'cid2_creation_date','cid2_approve_date',
    ];

    $fields = [];

    foreach ($stringCols as $col) {
        if (array_key_exists($col, $body)) {
            $fields[$col] = $body[$col] !== null ? sanitizeString($body[$col], 255) : null;
        }
    }

    foreach ($textCols as $col) {
        if (array_key_exists($col, $body)) {
            $fields[$col] = $body[$col] !== null ? sanitizeString($body[$col]) : null;
        }
    }

    foreach ($decimalCols as $col) {
        if (array_key_exists($col, $body)) {
            $fields[$col] = $body[$col] !== null ? sanitizeFloat($body[$col]) : null;
        }
    }

    if (array_key_exists('lat', $body)) $fields['lat'] = $body['lat'] !== null ? sanitizeLat($body['lat'])   : null;
    if (array_key_exists('lng', $body)) $fields['lng'] = $body['lng'] !== null ? sanitizeLng($body['lng'])   : null;

    foreach ($dateCols as $col) {
        if (array_key_exists($col, $body)) {
            $fields[$col] = $body[$col] !== null ? sanitizeDate($body[$col]) : null;
        }
    }

    // blocking — 0 adalah nilai valid, jangan filter
    if (array_key_exists('blocking', $body)) {
        $fields['blocking'] = (bool)$body['blocking'] ? 1 : 0;
    }

    // custom_fields — JSON passthrough
    if (array_key_exists('custom_fields', $body)) {
        $cf = $body['custom_fields'];
        $fields['custom_fields'] = ($cf !== null && is_array($cf)) ? json_encode($cf, JSON_UNESCAPED_UNICODE) : null;
    }

    return $fields;
}
