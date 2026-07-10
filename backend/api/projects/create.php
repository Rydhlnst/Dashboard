<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();
$body  = getRequestBody();

$fields = buildProjectFields($body, $admin['id']);

$db   = getDB();
$cols = implode(', ', array_keys($fields));
$plhs = implode(', ', array_fill(0, count($fields), '?'));

$stmt = $db->prepare("INSERT INTO project_records ({$cols}, created_at, updated_at) VALUES ({$plhs}, NOW(), NOW())");
$stmt->execute(array_values($fields));
$newId = (int)$db->lastInsertId();

AuditLog::log($admin['id'], 'create', 'project_record', (string)$newId, "Created project record ID {$newId}");

jsonSuccess(['id' => $newId], 'Project created successfully.', 201);

function buildProjectFields(array $body, int $userId): array {
    $longTextCols = ['sow_actual','notes_progress','gap_analysis','support_needed','detail_pic_blocking',
        'gap_closing','remarks_sow','atp_blocking','lv_blocking','oac_blocking','qc_blocking',
        'sqac_blocking','baut_blocking','bast_blocking'];

    $stringCols = [
        'po_year','pdid','caid','scarlett_ioms_id_before','scarlett_ioms_id_final',
        'status_po','pono_tsel','band','sector','project_category','vendor_principle',
        'cr_status','status_eba_mapping','eba_mapping_number','donor_act_siteid',
        'donor_nop','donor_tp','donor_progress','replan_dismantle','donor_dismantle_actual',
        'siteid_po','siteid_act','neid_act','site_name','infra_type','city','province',
        'nop','tp_detail','rfs_month','mitra_impl','progress_act','progress_done_flag',
        'issue_category','pic_blocking','current_position','status_project',
        'progress_closing','sub_progress_closing',
        'atp_status','lv_status','oac_status','qc_status','sqac_status','baut_status','bast_status',
        'wbs_level3','network_number','cid1','cid2',
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

    $decimalCols = [
        'capex','lat','lng',
        'price_po','price_po_to_be_claim','price_bast','remaining_po','price_po_presales',
        'cid1_price_bast','cid2_price_bast','plan_po','released_po',
    ];

    $fields = [];

    // Dataset type
    $ds = $body['dataset_type'] ?? 'closing';
    $fields['dataset_type'] = in_array($ds, ['closing','filter900','refinement']) ? $ds : 'closing';

    foreach ($stringCols as $col) {
        if (array_key_exists($col, $body)) {
            $fields[$col] = sanitizeString($body[$col], 255);
        }
    }
    foreach ($longTextCols as $col) {
        if (array_key_exists($col, $body)) {
            $fields[$col] = sanitizeString($body[$col]);
        }
    }
    foreach ($dateCols as $col) {
        if (array_key_exists($col, $body)) {
            $fields[$col] = sanitizeDate($body[$col]);
        }
    }
    foreach ($decimalCols as $col) {
        if (array_key_exists($col, $body)) {
            if ($col === 'lat') $fields[$col] = sanitizeLat($body[$col]);
            elseif ($col === 'lng') $fields[$col] = sanitizeLng($body[$col]);
            else $fields[$col] = sanitizeFloat($body[$col]);
        }
    }

    $fields['blocking'] = isset($body['blocking']) ? ((bool)$body['blocking'] ? 1 : 0) : 0;
    $fields['created_by'] = $userId;
    $fields['updated_by'] = $userId;

    // Custom fields JSON for any extra dynamic columns
    if (!empty($body['custom_fields']) && is_array($body['custom_fields'])) {
        $fields['custom_fields'] = json_encode($body['custom_fields'], JSON_UNESCAPED_UNICODE);
    }

    return array_filter($fields, fn($v, $k) => $k === 'blocking' || $v !== null, ARRAY_FILTER_USE_BOTH);
}
