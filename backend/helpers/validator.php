<?php
/**
 * Row-level validator for the import staging pipeline.
 *
 * Uses data_cleaner.php — must be required before this file.
 */

declare(strict_types=1);

// ─────────────────────────────────────────────────────────────────────────────
// Required fields — these trigger an ERROR (row rejected) if empty after clean
// ─────────────────────────────────────────────────────────────────────────────

const IMPORT_REQUIRED_FIELDS = [
    'pdid'             => 'PDID',
    'po_year'          => 'PO Year',
    'status_po'        => 'Status PO',
    'project_category' => 'Project Category',
    'sow_actual'       => 'SOW Actual',
    'vendor_principle' => 'Vendor Principle',
];

// ─────────────────────────────────────────────────────────────────────────────
// Special-value normalisation
// ─────────────────────────────────────────────────────────────────────────────

function normaliseProgressFlag(string $raw): ?string {
    $v = strtolower(trim($raw));
    if (in_array($v, ['1','rfs','done','completed','selesai','y','yes'], true)) return '1';
    if (in_array($v, ['x','drop','cancel','cancelled','batal'], true))          return 'x';
    if (in_array($v, ['0','','not yet','belum','ongoing'], true))               return '0';
    return mb_substr($raw, 0, 10);   // keep raw if unexpected
}

function normaliseStatusPo(string $raw): string {
    $v = strtolower(trim($raw));
    if ($v === 'drop')  return 'Drop';
    if ($v === 'hold')  return 'Hold';
    if (in_array($v, ['active','aktif','open'], true)) return 'Active';
    return trim($raw);
}

function computeBlocking(array $cleaned): bool {
    $pic = strtoupper(trim($cleaned['pic_blocking'] ?? ''));
    if ($pic === '') return false;
    return str_contains($pic, 'TSEL')
        || preg_match('/\bTI\b/', $pic)
        || preg_match('/\bTP\b/', $pic);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main validator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clean + validate a mapped row.
 *
 * @param array  $mappedData   {field_key: raw_string_value}
 * @param string $datasetType
 * @param array  $batchPdids   PDIDs seen so far in this batch (passed by ref, updated)
 * @param array  $dbPdids      PDIDs already in DB for this dataset — keyed by PDID uppercased
 *
 * @return array [$cleanedData, $status, $errors, $warnings]
 *               $status: 'valid' | 'warning' | 'error'
 */
function validateRow(
    array  $mappedData,
    string $datasetType,
    array  &$batchPdids,
    array  $dbPdids
): array {
    $errors   = [];
    $warnings = [];
    $cleaned  = [];

    // ── 1. Clean every field ──────────────────────────────────────────────
    foreach ($mappedData as $fieldKey => $rawVal) {
        $raw = trim((string)($rawVal ?? ''));

        // Special handling for progress_done_flag before cleaning
        if ($fieldKey === 'progress_done_flag') {
            $cleaned[$fieldKey] = $raw !== '' ? normaliseProgressFlag($raw) : null;
            continue;
        }

        if ($fieldKey === 'status_po') {
            $cleaned[$fieldKey] = $raw !== '' ? normaliseStatusPo($raw) : null;
            continue;
        }

        [$val, $fieldWarns, $fieldErrors] = cleanFieldValue($fieldKey, $raw);
        $cleaned[$fieldKey] = $val;

        foreach ($fieldErrors as $msg) {
            $errors[]   = ['field' => $fieldKey, 'message' => $msg];
        }
        foreach ($fieldWarns as $msg) {
            $warnings[] = ['field' => $fieldKey, 'message' => $msg];
        }
    }

    // ── 2. Required fields ────────────────────────────────────────────────
    foreach (IMPORT_REQUIRED_FIELDS as $field => $label) {
        if (empty($cleaned[$field])) {
            $errors[] = ['field' => $field, 'message' => "Required field '{$label}' is missing or empty."];
        }
    }

    // ── 3. PDID duplicate detection ───────────────────────────────────────
    if (!empty($cleaned['pdid'])) {
        $pdidUpper = strtoupper($cleaned['pdid']);

        // Duplicate within the current batch
        if (isset($batchPdids[$pdidUpper])) {
            $warnings[] = ['field' => 'pdid', 'message' => "PDID '{$cleaned['pdid']}' appears more than once in this file — only first occurrence will be imported."];
        } else {
            $batchPdids[$pdidUpper] = true;
        }

        // Already exists in DB for this dataset
        if (isset($dbPdids[$pdidUpper])) {
            $warnings[] = ['field' => 'pdid', 'message' => "PDID '{$cleaned['pdid']}' already exists in {$datasetType} dataset — record will be updated (overwritten)."];
        }
    }

    // ── 4. Compute derived flags ──────────────────────────────────────────
    $cleaned['blocking'] = computeBlocking($cleaned) ? 1 : 0;

    // ── 5. Determine status ───────────────────────────────────────────────
    $status = 'valid';
    if (!empty($errors))   $status = 'error';
    elseif (!empty($warnings)) $status = 'warning';

    return [$cleaned, $status, $errors, $warnings];
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helper: load existing PDIDs for a dataset
// ─────────────────────────────────────────────────────────────────────────────

function loadDbPdids(PDO $pdo, string $datasetType): array {
    $stmt = $pdo->prepare(
        "SELECT UPPER(pdid) AS pdid FROM project_records WHERE dataset_type = ? AND deleted_at IS NULL AND pdid IS NOT NULL"
    );
    $stmt->execute([$datasetType]);
    $result = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $result[$row['pdid']] = true;
    }
    return $result;
}
