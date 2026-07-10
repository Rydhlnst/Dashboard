<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../helpers/upload.php';
require_once __DIR__ . '/../../models/AuditLog.php';

$autoload = __DIR__ . '/../../vendor/autoload.php';
if (!file_exists($autoload)) {
    jsonError('PhpSpreadsheet not installed. Run: composer install in /backend', 500);
}
require_once $autoload;

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Cell\Cell;

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
if ($valError) {
    jsonError($valError, 422);
}

$tmpPath = null;
try {
    $tmpPath  = moveUploadToTemp($file);
    $fileName = basename($file['name']);

    $spreadsheet = IOFactory::load($tmpPath);
    $sheet       = $spreadsheet->getActiveSheet();

    // Gunakan getHighestRow/Column untuk iterasi — lebih aman dari toArray
    $highestRow = $sheet->getHighestRow();
    $highestCol = $sheet->getHighestColumn();

    if ($highestRow < 3) {
        jsonError('Excel file must have at least 3 rows (title, header, data).', 422);
    }

    // Baca header dari baris 2 (index 2, karena PhpSpreadsheet 1-based)
    $headerRow = [];
    $colIterator = $sheet->getColumnIterator('A', $highestCol);
    foreach ($colIterator as $col) {
        $colIdx  = $col->getColumnIndex();
        $cell    = $sheet->getCell($colIdx . '2');
        $headerRow[$colIdx] = trim((string)$cell->getValue());
    }

    $columnMap = buildColumnMap($headerRow); // colLetter => dbColumn

    $db         = getDB();
    $totalRows  = 0;
    $successRows= 0;
    $failedRows = 0;
    $errors     = [];

    $batchStmt = $db->prepare(
        'INSERT INTO import_batches (file_name, total_rows, success_rows, failed_rows, imported_by, imported_at)
         VALUES (?, 0, 0, 0, ?, NOW())'
    );
    $batchStmt->execute([$fileName, $admin['id']]);
    $batchId = (int)$db->lastInsertId();

    $insertSql  = buildInsertSql();
    $insertStmt = $db->prepare($insertSql);

    // Data dari baris 3 dst (1-based, baris 1 = judul, baris 2 = header)
    for ($rowNum = 3; $rowNum <= $highestRow; $rowNum++) {
        // Cek apakah baris kosong
        $rowData = [];
        $isEmpty = true;
        foreach ($columnMap as $colLetter => $dbCol) {
            $rawCell = $sheet->getCell($colLetter . $rowNum);
            $val     = getCellValue($rawCell);
            $rowData[$colLetter] = $val;
            if ($val !== null && $val !== '') $isEmpty = false;
        }
        if ($isEmpty) continue;

        $totalRows++;

        try {
            $record = mapRowToRecord($rowData, $columnMap, $batchId, $sheet, $rowNum);
            $insertStmt->execute(array_values($record));
            $successRows++;
        } catch (Throwable $e) {
            $failedRows++;
            $errors[] = ['row' => $rowNum, 'error' => $e->getMessage()];
        }
    }

    $updateBatch = $db->prepare(
        'UPDATE import_batches SET total_rows = ?, success_rows = ?, failed_rows = ? WHERE id = ?'
    );
    $updateBatch->execute([$totalRows, $successRows, $failedRows, $batchId]);

    AuditLog::log(
        $admin['id'], 'import', 'import_batch', (string)$batchId,
        "Imported '{$fileName}': {$successRows}/{$totalRows} rows success"
    );

    cleanupTempFile($tmpPath);

    jsonSuccess([
        'batch_id'    => $batchId,
        'file_name'   => $fileName,
        'total_rows'  => $totalRows,
        'success_rows'=> $successRows,
        'failed_rows' => $failedRows,
        'errors'      => array_slice($errors, 0, 20),
    ], "Import completed: {$successRows}/{$totalRows} rows imported.");

} catch (Throwable $e) {
    if ($tmpPath) cleanupTempFile($tmpPath);
    jsonError('Import failed: ' . $e->getMessage(), 500);
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/**
 * Ambil nilai cell dengan penanganan type yang tepat.
 * Return string untuk teks, float untuk angka, null untuk kosong.
 */
function getCellValue(Cell $cell): mixed {
    $dataType = $cell->getDataType();
    $value    = $cell->getValue();

    if ($value === null) return null;

    // Formula: hitung dulu
    if ($dataType === \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_FORMULA) {
        $value = $cell->getCalculatedValue();
    }

    return $value;
}

/**
 * Build map: colLetter => dbColumn
 */
function buildColumnMap(array $headers): array {
    $excelToDb = [
        'PDID'                      => 'pdid',
        'CAID'                      => 'caid',
        'Scarlett / IOMS ID Final'  => 'scarlett_ioms_id_final',
        'Status PO'                 => 'status_po',
        'PoNo Tsel'                 => 'pono_tsel',
        'Capex'                     => 'capex',
        'Band'                      => 'band',
        'Sector'                    => 'sector',
        'Project Category'          => 'project_category',
        'SOW Actual'                => 'sow_actual',
        'Vendor Principle'          => 'vendor_principle',
        'CR Status'                 => 'cr_status',
        'Status EBA Mapping'        => 'status_eba_mapping',
        'EBA Mapping Number'        => 'eba_mapping_number',
        'Donor Act SiteID'          => 'donor_act_siteid',
        'Donor NOP'                 => 'donor_nop',
        'Donor TP'                  => 'donor_tp',
        'Donor Progress'            => 'donor_progress',
        'Re-Plan Dismantle'         => 'replan_dismantle',
        'Donor Dismantle Actual'    => 'donor_dismantle_actual',
        'SiteID PO'                 => 'siteid_po',
        'SiteID Act'                => 'siteid_act',
        'NEID Act'                  => 'neid_act',
        'Site Name'                 => 'site_name',
        'Infra Type'                => 'infra_type',
        'Lat'                       => 'lat',
        'Long'                      => 'lng',
        'City'                      => 'city',
        'Province'                  => 'province',
        'NOP'                       => 'nop',
        'TP Detail'                 => 'tp_detail',
        'RFS Actual'                => 'rfs_actual',
        'RFS Month'                 => 'rfs_month',
        'Mitra Impl'                => 'mitra_impl',
        'Progress Act'              => 'progress_act',
        'Issue Category'            => 'issue_category',
        'Notes Progress'            => 'notes_progress',
        'GAP Analysis'              => 'gap_analysis',
        'Blocking'                  => 'blocking',
        'Support Needed'            => 'support_needed',
        'PIC Blocking'              => 'pic_blocking',
        'Detail PIC Blocking'       => 'detail_pic_blocking',
        'Current Position'          => 'current_position',
        'Status Project'            => 'status_project',
        'Progress Closing'          => 'progress_closing',
        'Sub Progress Closing'      => 'sub_progress_closing',
        'ATP Status'                => 'atp_status',
        'LV Status'                 => 'lv_status',
        'OAC Status'                => 'oac_status',
        'QC Status'                 => 'qc_status',
        'SQAC Status'               => 'sqac_status',
        'BAUT Status'               => 'baut_status',
        'BAST Status'               => 'bast_status',
    ];

    $result = []; // colLetter => dbColumn
    foreach ($headers as $colLetter => $header) {
        $h = trim((string)$header);
        if ($h === '') continue;
        foreach ($excelToDb as $excelHeader => $dbCol) {
            if (strcasecmp($h, $excelHeader) === 0) {
                $result[$colLetter] = $dbCol;
                break;
            }
        }
    }
    return $result;
}

// Kolom TEXT (tidak ada batas panjang di DB)
const TEXT_COLUMNS = ['sow_actual', 'notes_progress', 'gap_analysis', 'support_needed', 'detail_pic_blocking'];
// Batas panjang kolom VARCHAR
const VARCHAR_MAX  = 255;

function mapRowToRecord(array $rowData, array $columnMap, int $batchId, $sheet, int $rowNum): array {
    $record = [
        'import_batch_id'        => $batchId,
        'pdid'                   => null,
        'caid'                   => null,
        'scarlett_ioms_id_final' => null,
        'status_po'              => null,
        'pono_tsel'              => null,
        'capex'                  => null,
        'band'                   => null,
        'sector'                 => null,
        'project_category'       => null,
        'sow_actual'             => null,
        'vendor_principle'       => null,
        'cr_status'              => null,
        'status_eba_mapping'     => null,
        'eba_mapping_number'     => null,
        'donor_act_siteid'       => null,
        'donor_nop'              => null,
        'donor_tp'               => null,
        'donor_progress'         => null,
        'replan_dismantle'       => null,
        'donor_dismantle_actual' => null,
        'siteid_po'              => null,
        'siteid_act'             => null,
        'neid_act'               => null,
        'site_name'              => null,
        'infra_type'             => null,
        'lat'                    => null,
        'lng'                    => null,
        'city'                   => null,
        'province'               => null,
        'nop'                    => null,
        'tp_detail'              => null,
        'rfs_actual'             => null,
        'rfs_month'              => null,
        'mitra_impl'             => null,
        'progress_act'           => null,
        'issue_category'         => null,
        'notes_progress'         => null,
        'gap_analysis'           => null,
        'blocking'               => 0,
        'support_needed'         => null,
        'pic_blocking'           => null,
        'detail_pic_blocking'    => null,
        'current_position'       => null,
        'status_project'         => null,
        'progress_closing'       => null,
        'sub_progress_closing'   => null,
        'atp_status'             => null,
        'lv_status'              => null,
        'oac_status'             => null,
        'qc_status'              => null,
        'sqac_status'            => null,
        'baut_status'            => null,
        'bast_status'            => null,
    ];

    foreach ($columnMap as $colLetter => $dbCol) {
        $val = $rowData[$colLetter] ?? null;
        if ($val === null || trim((string)$val) === '') {
            continue; // tetap null dari default
        }

        switch ($dbCol) {
            case 'capex':
                // Angka bisa berupa float dari Excel atau string dengan format koma
                if (is_float($val) || is_int($val)) {
                    $record[$dbCol] = round((float)$val, 2);
                } else {
                    $record[$dbCol] = sanitizeFloat((string)$val); // handles "1,234,567.89"
                }
                break;

            case 'lat':
                $f = is_numeric($val) ? (float)$val : sanitizeFloat((string)$val);
                $record[$dbCol] = ($f !== null && $f >= -90.0 && $f <= 90.0) ? round($f, 7) : null;
                break;

            case 'lng':
                $f = is_numeric($val) ? (float)$val : sanitizeFloat((string)$val);
                $record[$dbCol] = ($f !== null && $f >= -180.0 && $f <= 180.0) ? round($f, 7) : null;
                break;

            case 'blocking':
                $lower = strtolower(trim((string)$val));
                $record[$dbCol] = in_array($lower, ['yes','ya','1','true','blocking','y'], true) ? 1 : 0;
                break;

            case 'rfs_actual':
                // PhpSpreadsheet: jika cell berformat date, nilai raw adalah float (serial number)
                $cell = $sheet->getCell($colLetter . $rowNum);
                if (ExcelDate::isDateTime($cell) && (is_float($val) || is_int($val))) {
                    $dt = ExcelDate::excelToDateTimeObject((float)$val);
                    $record[$dbCol] = $dt->format('Y-m-d');
                } else {
                    $record[$dbCol] = sanitizeDate((string)$val);
                }
                break;

            default:
                // String — strip_tags, no htmlspecialchars
                $str = strip_tags(trim((string)$val));
                if ($str === '') break;

                // TEXT columns tidak dibatasi; VARCHAR dibatasi 255
                $isText = in_array($dbCol, TEXT_COLUMNS, true);
                $record[$dbCol] = $isText ? $str : mb_substr($str, 0, VARCHAR_MAX);
                break;
        }
    }

    return $record;
}

function buildInsertSql(): string {
    $cols = [
        'import_batch_id','pdid','caid','scarlett_ioms_id_final','status_po','pono_tsel',
        'capex','band','sector','project_category','sow_actual','vendor_principle','cr_status',
        'status_eba_mapping','eba_mapping_number','donor_act_siteid','donor_nop','donor_tp',
        'donor_progress','replan_dismantle','donor_dismantle_actual','siteid_po','siteid_act',
        'neid_act','site_name','infra_type','lat','lng','city','province','nop','tp_detail',
        'rfs_actual','rfs_month','mitra_impl','progress_act','issue_category','notes_progress',
        'gap_analysis','blocking','support_needed','pic_blocking','detail_pic_blocking',
        'current_position','status_project','progress_closing','sub_progress_closing',
        'atp_status','lv_status','oac_status','qc_status','sqac_status','baut_status','bast_status',
    ];
    $colStr = implode(', ', $cols);
    $plh    = implode(', ', array_fill(0, count($cols), '?'));
    return "INSERT INTO project_records ({$colStr}, created_at, updated_at) VALUES ({$plh}, NOW(), NOW())";
}
