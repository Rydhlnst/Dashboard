<?php
/**
 * Data Cleaner — per-field cleaning for import staging pipeline.
 *
 * All public functions return [$cleanedValue, $warnings[], $errors[]]
 * so callers can collect issues without crashing the import.
 */

declare(strict_types=1);

// ─────────────────────────────────────────────────────────────────────────────
// Field-type registry
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_TYPES = [
    // Dates (nullable, various formats)
    'date' => [
        'rfs_actual','replan_rfs','atp_tagging_plan_ori','atp_tagging_replan','atp_tagging_done',
        'atp_approved','elv_plan_ori','elv_replan','elv_approved',
        'oac_plan_ori','oac_replan','oac_approved',
        'qc_plan_ori','qc_replan','qc_sign',
        'sqac_plan_ori','sqac_replan','sqac_approved',
        'baut_plan_ori','baut_replan','baut_approved',
        'bast_plan_ori','bast_replan','bast_approved',
        'cid1_creation_date','cid1_approve_date',
        'cid2_creation_date','cid2_approve_date',
    ],
    // Currency / decimal (IDR amounts)
    'currency' => [
        'price_po','price_po_to_be_claim','price_bast','remaining_po',
        'price_po_presales','cid1_price_bast','cid2_price_bast',
        'capex','plan_po','released_po',
    ],
    // Coordinates
    'decimal' => ['lat','lng'],
    // Year (4 digit)
    'year'    => ['po_year'],
    // Long text — no truncation
    'longtext' => [
        'detail_pic_blocking','notes_progress','gap_analysis','gap_closing',
        'sow_actual','support_needed','remarks_sow','blocking',
    ],
];

function getFieldType(string $fieldKey): string {
    foreach (FIELD_TYPES as $type => $keys) {
        if (in_array($fieldKey, $keys, true)) return $type;
    }
    return 'text';
}

// ─────────────────────────────────────────────────────────────────────────────
// Date cleaning
// ─────────────────────────────────────────────────────────────────────────────

// Values that mean "no date" — treated as null silently
const DATE_NULL_VALUES = [
    '', '-', 'n/a', '#n/a', '#value!', '#ref!', 'tbd', 'n.a', 'na',
    'no need', 'drop', 'belum', 'none', '0',
];

// Values flagged as dropped/special
const DATE_SPECIAL_STATUS = ['x'];

function cleanDate(string $raw): array {
    $warnings = [];
    $errors   = [];
    $val      = trim($raw);

    if (in_array(strtolower($val), DATE_NULL_VALUES, true)) {
        return [null, $warnings, $errors];
    }

    // Excel default date artefact
    if ($val === '1/0/1900' || $val === '01/00/1900' || $val === '0/0/1900') {
        $warnings[] = "Date value '{$val}' is an Excel default (epoch) — treated as null.";
        return [null, $warnings, $errors];
    }

    // Special status markers (x, drop) stored as progress_done_flag not date
    if (in_array(strtolower($val), DATE_SPECIAL_STATUS, true)) {
        return [null, $warnings, $errors];
    }

    $parsed = tryParseDate($val);
    if ($parsed !== null) {
        return [$parsed, $warnings, $errors];
    }

    $errors[] = "Cannot parse date '{$val}'. Accepted formats: YYYY-MM-DD, DD-Mon-YY, DD/Mon/YY, MM/DD/YYYY, DD/MMM/YY.";
    return [null, $warnings, $errors];
}

function tryParseDate(string $val): ?string {
    $val = trim($val);

    // Already ISO: 2025-08-29
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $val, $m)) {
        if (checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
            return $val;
        }
        return null;
    }

    // DD-Mon-YY or DD/Mon/YY or DD-Mon-YYYY  e.g. 10-Mar-26, 21/Aug/25
    if (preg_match('/^(\d{1,2})[-\/]([A-Za-z]{3,9})[-\/](\d{2,4})$/', $val, $m)) {
        $day   = (int)$m[1];
        $month = parseMonthName($m[2]);
        $year  = (int)$m[3];
        if ($year < 100) $year += ($year >= 50 ? 1900 : 2000);
        if ($month && checkdate($month, $day, $year)) {
            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }
    }

    // MM/DD/YYYY  e.g. 8/29/2025
    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $val, $m)) {
        $month = (int)$m[1];
        $day   = (int)$m[2];
        $year  = (int)$m[3];
        if (checkdate($month, $day, $year)) {
            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }
        // Try D/M/Y as fallback
        if (checkdate($day, $month, $year)) {
            return sprintf('%04d-%02d-%02d', $year, $day, $month);
        }
    }

    // DD/MM/YY or MM/DD/YY two-digit year
    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/', $val, $m)) {
        $a    = (int)$m[1];
        $b    = (int)$m[2];
        $year = (int)$m[3] + ($m[3] >= '50' ? 1900 : 2000);
        if (checkdate($a, $b, $year))      return sprintf('%04d-%02d-%02d', $year, $a, $b);
        if (checkdate($b, $a, $year))      return sprintf('%04d-%02d-%02d', $year, $b, $a);
    }

    // PHP strtotime fallback (last resort, handles many formats)
    $ts = @strtotime($val);
    if ($ts && $ts > 0 && $ts < strtotime('2100-01-01')) {
        return date('Y-m-d', $ts);
    }

    return null;
}

function parseMonthName(string $name): ?int {
    static $map = [
        'jan'=>1,'january'=>1,'feb'=>2,'february'=>2,'mar'=>3,'march'=>3,
        'apr'=>4,'april'=>4,'may'=>5,'jun'=>6,'june'=>6,'jul'=>7,'july'=>7,
        'aug'=>8,'august'=>8,'sep'=>9,'sept'=>9,'september'=>9,
        'oct'=>10,'october'=>10,'nov'=>11,'november'=>11,'dec'=>12,'december'=>12,
    ];
    return $map[strtolower($name)] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Number / currency cleaning
// ─────────────────────────────────────────────────────────────────────────────

function cleanCurrency(string $raw): array {
    $val = trim($raw);
    if ($val === '' || $val === '-') return [null, [], []];

    // Strip currency symbols, commas, spaces
    $cleaned = preg_replace('/[Rp\s,]/', '', $val);
    $cleaned = str_replace(['IDR', 'idr', 'USD'], '', $cleaned);
    $cleaned = trim($cleaned);

    if ($cleaned === '' || $cleaned === '-') return [null, [], []];
    if (!is_numeric($cleaned)) {
        return [null, ["Currency value '{$val}' is not numeric — stored as empty."], []];
    }
    return [round((float)$cleaned, 2), [], []];
}

function cleanDecimal(string $raw): array {
    $val = trim($raw);
    if ($val === '' || $val === '-') return [null, [], []];
    $cleaned = preg_replace('/[^\d.\-]/', '', $val);
    if ($cleaned === '' || !is_numeric($cleaned)) {
        return [null, [], ["Decimal value '{$val}' is not numeric."]];
    }
    return [(float)$cleaned, [], []];
}

function cleanYear(string $raw): array {
    $val = trim($raw);
    if ($val === '') return [null, [], []];
    $year = (int)preg_replace('/\D/', '', $val);
    if ($year < 2000 || $year > 2099) {
        return [null, [], ["Year '{$val}' is out of expected range 2000–2099."]];
    }
    return [(string)$year, [], []];
}

// ─────────────────────────────────────────────────────────────────────────────
// Text cleaning
// ─────────────────────────────────────────────────────────────────────────────

function cleanText(string $raw, bool $long = false): array {
    $val = trim($raw);
    if ($val === '') return [null, [], []];
    $val = strip_tags($val);
    // Normalise internal whitespace
    $val = preg_replace('/\s+/', ' ', $val);
    if (!$long) $val = mb_substr($val, 0, 255);
    return [$val, [], []];
}

// ─────────────────────────────────────────────────────────────────────────────
// Master dispatcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clean a single raw field value.
 *
 * @return array [$cleanedValue, $warnings, $errors]
 */
function cleanFieldValue(string $fieldKey, string $rawVal): array {
    $type = getFieldType($fieldKey);
    return match ($type) {
        'date'     => cleanDate($rawVal),
        'currency' => cleanCurrency($rawVal),
        'decimal'  => cleanDecimal($rawVal),
        'year'     => cleanYear($rawVal),
        'longtext' => cleanText($rawVal, true),
        default    => cleanText($rawVal, false),   // 'text' and everything else
    };
}
