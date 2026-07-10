<?php

// CSV/Excel header → DB column name mapping
// Used during import to map file headers to project_records fields.
// Keys are Excel header labels; values are DB column names.

const EXCEL_COLUMN_MAP = [
    // Core identification
    'PDID'                          => 'pdid',
    'PO Year'                       => 'po_year',
    'CAID'                          => 'caid',
    'Scarlett / IOMS ID Before'     => 'scarlett_ioms_id_before',
    'Scarlett / IOMS ID Final'      => 'scarlett_ioms_id_final',
    'Status PO'                     => 'status_po',
    'PoNo Tsel'                     => 'pono_tsel',
    'Capex'                         => 'capex',
    'Band'                          => 'band',
    'Sector'                        => 'sector',
    'Project Category'              => 'project_category',
    'SOW Actual'                    => 'sow_actual',
    'Vendor Principle'              => 'vendor_principle',
    'CR Status'                     => 'cr_status',
    'Status EBA Mapping'            => 'status_eba_mapping',
    'EBA Mapping Number'            => 'eba_mapping_number',
    'Donor Act SiteID'              => 'donor_act_siteid',
    'Donor NOP'                     => 'donor_nop',
    'Donor TP'                      => 'donor_tp',
    'Donor Progress'                => 'donor_progress',
    'Re-Plan Dismantle'             => 'replan_dismantle',
    'Donor Dismantle Actual'        => 'donor_dismantle_actual',

    // Site info
    'SiteID PO'                     => 'siteid_po',
    'SiteID Act'                    => 'siteid_act',
    'NEID Act'                      => 'neid_act',
    'Site Name'                     => 'site_name',
    'Infra Type'                    => 'infra_type',
    'Lat'                           => 'lat',
    'Long'                          => 'lng',
    'City'                          => 'city',
    'Province'                      => 'province',
    'NOP'                           => 'nop',
    'TP Detail'                     => 'tp_detail',

    // Progress
    'Progress Done (FLAG)'          => 'progress_done_flag',
    'RFS Actual'                    => 'rfs_actual',
    'RFS Month'                     => 'rfs_month',
    'Mitra Impl'                    => 'mitra_impl',
    'Progress Act'                  => 'progress_act',
    'Issue Category'                => 'issue_category',
    'Notes Progress'                => 'notes_progress',
    'GAP Analysis'                  => 'gap_analysis',
    'Blocking'                      => 'blocking',
    'Support Needed'                => 'support_needed',
    'PIC Blocking'                  => 'pic_blocking',
    'Detail PIC Blocking'           => 'detail_pic_blocking',
    'Gap Closing'                   => 'gap_closing',
    'Current Position'              => 'current_position',
    'Status Project'                => 'status_project',
    'Status Project*'               => 'status_project',
    'Progress Closing'              => 'progress_closing',
    'Sub Progress Closing'          => 'sub_progress_closing',

    // Acceptance stage status
    'ATP Status'                    => 'atp_status',
    'LV Status'                     => 'lv_status',
    'OAC Status'                    => 'oac_status',
    'QC Status'                     => 'qc_status',
    'SQAC Status'                   => 'sqac_status',
    'BAUT Status'                   => 'baut_status',
    'BAST Status'                   => 'bast_status',

    // Acceptance blocking
    'ATP Blocking'                  => 'atp_blocking',
    'LV Blocking'                   => 'lv_blocking',
    'OAC Blocking'                  => 'oac_blocking',
    'QC Blocking'                   => 'qc_blocking',
    'SQAC Blocking'                 => 'sqac_blocking',
    'BAUT Blocking'                 => 'baut_blocking',
    'BAST Blocking'                 => 'bast_blocking',

    // Acceptance dates — ATP
    'Tagging Plan Ori'              => 'atp_tagging_plan_ori',
    'Tagging Re-plan'               => 'atp_tagging_replan',
    'Tagging Done'                  => 'atp_tagging_done',
    'ATP Approved'                  => 'atp_approved',

    // Acceptance dates — LV
    'eLV Plan Ori'                  => 'elv_plan_ori',
    'eLV Re-Plan'                   => 'elv_replan',
    'eLV Approved'                  => 'elv_approved',

    // Acceptance dates — OAC
    'OAC Plan Ori'                  => 'oac_plan_ori',
    'OAC Re-Plan'                   => 'oac_replan',
    'OAC Approved (Final)'          => 'oac_approved',
    'OAC Approved'                  => 'oac_approved',

    // Acceptance dates — QC
    'QC Plan Ori'                   => 'qc_plan_ori',
    'QC Re-Plan'                    => 'qc_replan',
    'QC Sign'                       => 'qc_sign',

    // Acceptance dates — SQAC
    'SQAC Plan Ori'                 => 'sqac_plan_ori',
    'SQAC Re-Plan'                  => 'sqac_replan',
    'SQAC Approved'                 => 'sqac_approved',

    // Acceptance dates — BAUT
    'BAUT Plan Ori'                 => 'baut_plan_ori',
    'BAUT Re-Plan'                  => 'baut_replan',
    'BAUT Approved'                 => 'baut_approved',

    // Acceptance dates — BAST
    'BAST Plan Ori'                 => 'bast_plan_ori',
    'BAST Re-Plan'                  => 'bast_replan',
    'BAST Approved'                 => 'bast_approved',

    // Financial
    'Price PO'                      => 'price_po',
    'Price PO to be Claim'          => 'price_po_to_be_claim',
    'Price BAST (Ach)'              => 'price_bast',
    'Remaining PO'                  => 'remaining_po',
    'Price PO Presales'             => 'price_po_presales',
    'WBS Level3'                    => 'wbs_level3',
    'Network Number'                => 'network_number',
    'CID-1'                         => 'cid1',
    'CID-1 Price BAST'              => 'cid1_price_bast',
    'CID-1 Creation date'           => 'cid1_creation_date',
    'CID-1 Approve date'            => 'cid1_approve_date',
    'CID-2'                         => 'cid2',
    'CID-2 Price BAST'              => 'cid2_price_bast',
    'CID-2 Creation date'           => 'cid2_creation_date',
    'CID-2 Approve date'            => 'cid2_approve_date',

    // Filter 900 specific
    'Remarks SOW'                   => 'remarks_sow',
    'Re-Plan RFS'                   => 'replan_rfs',
    'Plan PO'                       => 'plan_po',
    'Released'                      => 'released_po',
];

// DB columns that store dates
const DATE_COLUMNS = [
    'rfs_actual','atp_tagging_plan_ori','atp_tagging_replan','atp_tagging_done','atp_approved',
    'elv_plan_ori','elv_replan','elv_approved',
    'oac_plan_ori','oac_replan','oac_approved',
    'qc_plan_ori','qc_replan','qc_sign',
    'sqac_plan_ori','sqac_replan','sqac_approved',
    'baut_plan_ori','baut_replan','baut_approved',
    'bast_plan_ori','bast_replan','bast_approved',
    'cid1_creation_date','cid1_approve_date',
    'cid2_creation_date','cid2_approve_date',
    'replan_rfs',
];

// DB columns that store decimal numbers
const DECIMAL_COLUMNS = [
    'capex','lat','lng',
    'price_po','price_po_to_be_claim','price_bast','remaining_po','price_po_presales',
    'cid1_price_bast','cid2_price_bast',
    'plan_po','released_po',
];

// DB columns that store TEXT (no length limit)
const LONG_TEXT_COLUMNS = [
    'sow_actual','notes_progress','gap_analysis','support_needed','detail_pic_blocking',
    'gap_closing','remarks_sow',
    'atp_blocking','lv_blocking','oac_blocking','qc_blocking','sqac_blocking','baut_blocking','bast_blocking',
];

/**
 * Map an array of Excel headers (colLetter => header string) to DB column names.
 * Returns: colLetter => db_column_name
 * Unknown headers are returned as colLetter => null (to be handled by caller).
 */
function mapHeaders(array $headers): array {
    $result = [];
    foreach ($headers as $colLetter => $header) {
        $h = trim((string)$header);
        if ($h === '') continue;
        $hClean = rtrim($h, '* ');
        $dbCol = null;
        foreach (EXCEL_COLUMN_MAP as $excelHeader => $col) {
            $ehClean = rtrim($excelHeader, '* ');
            if (strcasecmp($hClean, $ehClean) === 0) {
                $dbCol = $col;
                break;
            }
        }
        $result[$colLetter] = ['header' => $h, 'db_col' => $dbCol];
    }
    return $result;
}

/**
 * Convert a header string to a valid field_key (snake_case, alphanumeric + underscore).
 */
function headerToFieldKey(string $header): string {
    $key = strtolower(trim($header));
    $key = preg_replace('/[^a-z0-9]+/', '_', $key);
    $key = trim($key, '_');
    return substr($key, 0, 100);
}
