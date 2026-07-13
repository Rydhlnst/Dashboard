<?php
/**
 * schema_builder.php — Dynamic dataset schema management
 *
 * Sanitises column/table names, infers SQL types, generates DDL,
 * and provides type-aware value cleaning for the import pipeline.
 *
 * PHP 7.x compatible — no match(), no str_contains(), no mixed type hints.
 */

declare(strict_types=1);

// ── Column letter ↔ index helpers (A=0, B=1, …, Z=25, AA=26, …) ──────────────

function indexToColumnLetter(int $index): string
{
    $letter = '';
    $n      = $index;
    do {
        $letter = chr(65 + ($n % 26)) . $letter;
        $n      = intdiv($n, 26) - 1;
    } while ($n >= 0);
    return $letter;
}

function columnLetterToIndex(string $letter): int
{
    $letter = strtoupper($letter);
    $index  = 0;
    for ($i = 0, $len = strlen($letter); $i < $len; $i++) {
        $index = $index * 26 + (ord($letter[$i]) - 64);
    }
    return $index - 1;
}

// ── Name sanitisation ──────────────────────────────────────────────────────────

// Meta-columns that every ds_* table has — user columns must not collide
const DS_RESERVED_COLS = ['_id', '_batch_id', '_imported_at'];

/**
 * Sanitise a dataset name to a URL/SQL-safe slug (no "ds_" prefix).
 */
function slugifyDatasetName(string $name): string
{
    $slug = mb_strtolower(trim($name));
    $slug = preg_replace('/[^a-z0-9]+/', '_', $slug);
    $slug = trim($slug, '_');
    if ($slug === '') $slug = 'dataset';
    return substr($slug, 0, 55);   // 55 + "ds_" = 58 < 64 (MySQL limit)
}

/**
 * Convert a dataset name to a full table name (ds_*).
 */
function buildTableName(string $datasetName): string
{
    return 'ds_' . slugifyDatasetName($datasetName);
}

/**
 * Sanitise a single column header string into a safe SQL column name.
 * Output: [a-z0-9_], starts with [a-z], max 60 chars.
 */
function sanitizeColName(string $header): string
{
    $name = mb_strtolower(trim($header));
    // Common separators → underscore before stripping
    $name = str_replace(['(',')','/','\\','-','.','%','#','@','!',' '], '_', $name);
    $name = preg_replace('/[^a-z0-9_]+/', '_', $name);
    $name = preg_replace('/_+/', '_', $name);
    $name = trim($name, '_');
    if ($name === '') return 'col';
    if (ctype_digit((string)$name[0])) $name = 'c' . $name;
    return substr($name, 0, 60);
}

/**
 * Build a deduplicated column-letter → col_name map from raw headers.
 *
 * @param string[] $headers  Indexed (0-based) array of raw header strings
 * @return array  ['A' => 'col_name'|null, …]  null = empty header, skip column
 */
function buildColumnMap(array $headers): array
{
    $seen   = [];   // base_name => usage count
    $result = [];   // col_letter => col_name|null

    foreach ($headers as $idx => $header) {
        $letter = indexToColumnLetter($idx);

        if (trim((string)$header) === '') {
            $result[$letter] = null;
            continue;
        }

        $base = sanitizeColName((string)$header);

        // Don't let user columns clobber meta-columns
        if (in_array($base, DS_RESERVED_COLS, true)) {
            $base = 'col_' . ltrim($base, '_');
        }

        // Deduplicate: first use keeps base name; subsequent get _2, _3 …
        if (isset($seen[$base])) {
            $seen[$base]++;
            $colName = $base . '_' . $seen[$base];
        } else {
            $seen[$base] = 1;
            $colName = $base;
        }

        $result[$letter] = $colName;
    }

    return $result;
}

// ── Type inference ─────────────────────────────────────────────────────────────

/**
 * Heuristic: does a string look like a date?
 */
function looksLikeDate(string $v): bool
{
    $v = trim($v);
    if ($v === '') return false;
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) return true;
    if (preg_match('/^\d{1,2}\/\d{1,2}\/\d{4}$/', $v)) return true;
    if (preg_match('/^\d{1,2}[-\/][A-Za-z]{3,9}[-\/]\d{2,4}$/', $v)) return true;
    if (preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $v)) return true;
    return false;
}

/**
 * Infer a SQL column type from a sample of raw string values.
 * Uses an 80 % threshold; returns a whitelisted type string.
 *
 * @param string[] $samples  Raw values (may include empty strings)
 * @return string  One of the types accepted by whitelistType()
 */
function inferColType(array $samples): string
{
    $values = [];
    foreach ($samples as $v) {
        $t = trim((string)$v);
        if ($t !== '') $values[] = $t;
    }
    if (empty($values)) return 'VARCHAR(255)';

    $n                 = count($values);
    $dateHits          = 0;
    $numHits           = 0;
    $decHits           = 0;
    $maxLen            = 0;
    $allYear           = true;
    $hasStructuredCode = false;   // mixed letters+digits that are not dates/currency

    foreach ($values as $v) {
        $maxLen = max($maxLen, mb_strlen($v));
        if (looksLikeDate($v)) {
            $dateHits++;
            if (!preg_match('/^(19|20)\d{2}$/', $v)) $allYear = false;
            continue;
        }

        // Strip currency/thousand-separator artefacts before numeric test
        $stripped = preg_replace('/[Rp$€£,\s]/', '', $v);
        $stripped = preg_replace('/\b(IDR|USD|EUR|GBP)\b/i', '', $stripped);
        $stripped = trim($stripped);

        if ($stripped !== '' && is_numeric($stripped)) {
            $numHits++;
            if (strpos($stripped, '.') !== false) $decHits++;
        } elseif (preg_match('/[A-Za-z]/', $stripped) && preg_match('/\d/', $stripped)) {
            // Value has both letters and digits and is not a date/currency
            // → likely a reference/code column (e.g. PO numbers like "0365/TC.03/EN-01")
            $hasStructuredCode = true;
        }

        if (!preg_match('/^(19|20)\d{2}$/', $v)) $allYear = false;
    }

    $pct = function (int $hits) use ($n): float {
        return $n > 0 ? ($hits / $n) : 0.0;
    };

    if ($pct($dateHits) >= 0.8) return 'DATE';

    // Skip numeric inference entirely when the column contains structured codes
    // (reference numbers, PO codes, etc.) — must stay VARCHAR to preserve values
    if (!$hasStructuredCode) {
        if ($allYear && $pct($numHits) >= 0.95) return 'SMALLINT UNSIGNED';
        if ($pct($numHits) >= 0.8)              return 'DECIMAL(18,4)';
    }

    if ($maxLen > 500) return 'TEXT';
    if ($maxLen > 255) return 'VARCHAR(500)';
    return 'VARCHAR(255)';
}

/**
 * Whitelist SQL type strings to prevent DDL injection.
 * Returns the canonical form, or VARCHAR(255) as safe fallback.
 */
function whitelistType(string $type): string
{
    static $allowed = [
        'DATE', 'DATETIME',
        'SMALLINT UNSIGNED', 'INT UNSIGNED', 'BIGINT UNSIGNED',
        'DECIMAL(18,4)',
        'VARCHAR(255)', 'VARCHAR(500)', 'TEXT', 'LONGTEXT',
    ];
    $up = strtoupper(trim($type));
    foreach ($allowed as $a) {
        if (strtoupper($a) === $up) return $a;
    }
    return 'VARCHAR(255)';
}

// ── DDL generation ─────────────────────────────────────────────────────────────

/**
 * CREATE TABLE IF NOT EXISTS for a dynamic dataset.
 *
 * @param PDO    $db
 * @param string $tableName  Pre-sanitised, e.g. "ds_my_dataset"
 * @param array  $columns    [{col_name, col_type, label}, …]
 */
function createDatasetTable(PDO $db, string $tableName, array $columns): void
{
    // Estimate row size and promote VARCHAR → TEXT if we'd blow MySQL's 65535-byte row limit.
    // utf8mb4 → 4 bytes per char + 2 length bytes. TEXT contributes ~12 bytes (off-page pointer).
    $rowBudget = 60000;   // leave 5KB headroom for meta cols + overhead
    $estimated = 0;
    foreach ($columns as $col) {
        $t = strtoupper(trim($col['col_type']));
        if (preg_match('/^VARCHAR\((\d+)\)$/', $t, $m)) $estimated += ((int)$m[1] * 4 + 2);
        elseif ($t === 'DECIMAL(18,4)')                $estimated += 9;
        elseif (in_array($t, ['DATE','SMALLINT UNSIGNED'], true)) $estimated += 3;
        elseif (in_array($t, ['INT UNSIGNED','DATETIME'], true))  $estimated += 5;
        elseif ($t === 'BIGINT UNSIGNED')              $estimated += 8;
        else                                           $estimated += 12; // TEXT-ish
    }
    $promoteToText = $estimated > $rowBudget;

    $defs = [];
    foreach ($columns as $col) {
        $safe = sanitizeColName($col['col_name']);
        if ($safe === '') continue;
        $type = whitelistType($col['col_type']);
        if ($promoteToText && strpos($type, 'VARCHAR') === 0) $type = 'TEXT';
        $defs[] = "  `{$safe}` {$type} DEFAULT NULL";
    }

    $colDefs = $defs ? implode(",\n", $defs) . ",\n" : '';
    $sql = "CREATE TABLE IF NOT EXISTS `{$tableName}` (\n"
         . "  `_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,\n"
         . "  `_batch_id` INT UNSIGNED DEFAULT NULL,\n"
         . "  `_imported_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n"
         . $colDefs
         . "  PRIMARY KEY (`_id`),\n"
         . "  KEY `idx_batch` (`_batch_id`)\n"
         . ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC";
    $db->exec($sql);
}

/**
 * ADD new columns to an existing ds_* table via ALTER TABLE.
 * Uses IF NOT EXISTS (MariaDB 10.0.2+).
 *
 * @param PDO    $db
 * @param string $tableName
 * @param array  $newCols  [{col_name, col_type}, …]
 */
function alterDatasetTable(PDO $db, string $tableName, array $newCols): void
{
    foreach ($newCols as $col) {
        $safe = sanitizeColName($col['col_name']);
        $type = whitelistType($col['col_type']);
        if ($safe === '') continue;
        $db->exec(
            "ALTER TABLE `{$tableName}` ADD COLUMN IF NOT EXISTS `{$safe}` {$type} DEFAULT NULL"
        );
    }
}

/**
 * Return columns in $newCols that are not already in $existingSchema.
 */
function findNewColumns(array $newCols, array $existingSchema): array
{
    $existing = [];
    foreach ($existingSchema as $col) {
        $existing[$col['col_name']] = true;
    }
    $added = [];
    foreach ($newCols as $col) {
        if (!isset($existing[$col['col_name']])) $added[] = $col;
    }
    return $added;
}

// ── Type-aware value cleaning ──────────────────────────────────────────────────

/**
 * Clean a raw string value according to its inferred column type.
 *
 * Normalization rules applied (Data Analyst approach):
 *  - DATE  : Excel zero-date (d/0/yyyy), semantic placeholders (Drop, Cancel, Hold, …) → NULL silently
 *  - INT   : boolean flags ('x','v','y','ok','✓') → 1; reference codes in int columns → NULL silently
 *  - DECIMAL: same flag/code handling as INT
 *
 * @return array [$cleanedValue, $warnings[], $errors[]]
 */
function cleanValueByType(string $rawVal, string $colType): array
{
    $val      = trim($rawVal);
    $warnings = [];
    $errors   = [];

    // Treat empty / dash as NULL
    if ($val === '' || $val === '-') return [null, $warnings, $errors];

    $type  = strtoupper(trim($colType));
    $lower = strtolower($val);

    // ── DATE ──────────────────────────────────────────────────────────────────

    if ($type === 'DATE') {
        // Semantic placeholder values → NULL with a warning so the user sees the row was cleaned
        static $semanticNullDates = [
            'n/a','#n/a','#value!','#ref!','tbd','tbc','n.a','na','none',
            '-','0','drop','cancel','cancelled','hold','pending','void',
            'blank','n/d','nd','nil','#na','#n/d','delete','deleted',
        ];
        if (in_array($lower, $semanticNullDates, true)) {
            $warnings[] = "Auto-cleaned: placeholder date '{$val}' set to NULL.";
            return [null, $warnings, $errors];
        }

        // Excel zero-date artifact: day component = 0 (e.g. "1/0/1900") → NULL with warning
        if (preg_match('/^\d{1,2}\/0\/\d{4}$/', $val)) {
            $warnings[] = "Auto-cleaned: Excel zero-date '{$val}' set to NULL.";
            return [null, $warnings, $errors];
        }

        $parsed = tryParseAnyDate($val);
        if ($parsed !== null) return [$parsed, $warnings, $errors];

        $warnings[] = "Could not parse date '{$val}' — stored as empty.";
        return [null, $warnings, $errors];
    }

    // ── DECIMAL ───────────────────────────────────────────────────────────────

    if ($type === 'DECIMAL(18,4)') {
        // Boolean flag values → normalize to 1 (warn so row is visible in review)
        static $flagValsDec = ['x','v','y','yes','true','done','ok','✓','√','■','●'];
        if (in_array($lower, $flagValsDec, true)) {
            $warnings[] = "Auto-cleaned: boolean flag '{$val}' normalized to 1.";
            return [1.0, $warnings, $errors];
        }

        $stripped = preg_replace('/[Rp$€£,\s]/', '', $val);
        $stripped = preg_replace('/\b(IDR|USD|EUR|GBP)\b/i', '', $stripped);
        $stripped = trim($stripped);
        if (is_numeric($stripped)) return [round((float)$stripped, 4), $warnings, $errors];

        // Structured reference code (letters + digits) → NULL with warning
        if (preg_match('/[A-Za-z]/', $val) && preg_match('/\d/', $val)) {
            $warnings[] = "Auto-cleaned: reference code '{$val}' cannot be stored as DECIMAL — set to NULL.";
            return [null, $warnings, $errors];
        }

        $warnings[] = "Could not parse number '{$val}' — stored as empty.";
        return [null, $warnings, $errors];
    }

    // ── SMALLINT / INT / BIGINT ───────────────────────────────────────────────

    if ($type === 'SMALLINT UNSIGNED' || $type === 'INT UNSIGNED' || $type === 'BIGINT UNSIGNED') {
        // Boolean flag values → normalize to 1 (warn so row is visible in review)
        static $flagValsInt = ['x','v','y','yes','true','done','ok','✓','√','■','●'];
        if (in_array($lower, $flagValsInt, true)) {
            $warnings[] = "Auto-cleaned: boolean flag '{$val}' normalized to 1.";
            return [1, $warnings, $errors];
        }

        $stripped = preg_replace('/[^0-9]/', '', $val);
        if ($stripped !== '') return [(int)$stripped, $warnings, $errors];

        // Text/reference in integer column → NULL with warning
        if (preg_match('/[A-Za-z]/', $val) && preg_match('/\d/', $val)) {
            $warnings[] = "Auto-cleaned: reference code '{$val}' cannot be stored as integer — set to NULL.";
            return [null, $warnings, $errors];
        }
        if (preg_match('/[A-Za-z]/', $val)) {
            $warnings[] = "Auto-cleaned: text value '{$val}' cannot be stored as integer — set to NULL.";
            return [null, $warnings, $errors];
        }

        $warnings[] = "Could not parse integer '{$val}' — stored as empty.";
        return [null, $warnings, $errors];
    }

    // ── TEXT / LONGTEXT ───────────────────────────────────────────────────────

    if ($type === 'TEXT' || $type === 'LONGTEXT') {
        $val = strip_tags($val);
        $val = preg_replace('/\s+/', ' ', $val);
        return [$val, $warnings, $errors];
    }

    // ── VARCHAR(255) / VARCHAR(500) / default ─────────────────────────────────

    $val    = strip_tags($val);
    $val    = preg_replace('/\s+/', ' ', $val);
    $maxLen = (strpos($type, '500') !== false) ? 500 : 255;
    $val    = mb_substr($val, 0, $maxLen);
    return [$val, $warnings, $errors];
}

/**
 * Parse a date string from many common formats into 'Y-m-d'.
 * Returns null when the string cannot be interpreted as a date.
 */
function tryParseAnyDate(string $val): ?string
{
    $val = trim($val);
    if ($val === '') return null;

    $nullLike = ['n/a','#n/a','#value!','#ref!','tbd','n.a','na','none','-','0'];
    if (in_array(strtolower($val), $nullLike, true)) return null;

    // ISO: 2025-08-29
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $val, $m)) {
        if (checkdate((int)$m[2], (int)$m[3], (int)$m[1])) return $val;
    }

    // DD-Mon-YY or DD/Mon/YYYY
    if (preg_match('/^(\d{1,2})[-\/]([A-Za-z]{3,9})[-\/](\d{2,4})$/', $val, $m)) {
        $day   = (int)$m[1];
        $month = sbParseMonthName($m[2]);
        $year  = (int)$m[3];
        if ($year < 100) $year += ($year >= 50 ? 1900 : 2000);
        if ($month && checkdate($month, $day, $year)) {
            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }
    }

    // MM/DD/YYYY or DD/MM/YYYY
    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $val, $m)) {
        $a = (int)$m[1]; $b = (int)$m[2]; $y = (int)$m[3];
        if (checkdate($a, $b, $y)) return sprintf('%04d-%02d-%02d', $y, $a, $b);
        if (checkdate($b, $a, $y)) return sprintf('%04d-%02d-%02d', $y, $b, $a);
    }

    // strtotime last resort
    $ts = @strtotime($val);
    if ($ts && $ts > 0 && $ts < strtotime('2100-01-01')) {
        return date('Y-m-d', $ts);
    }
    return null;
}

function sbParseMonthName(string $name): ?int
{
    static $map = [
        'jan'=>1,'january'=>1,'feb'=>2,'february'=>2,'mar'=>3,'march'=>3,
        'apr'=>4,'april'=>4,'may'=>5,'jun'=>6,'june'=>6,'jul'=>7,'july'=>7,
        'aug'=>8,'august'=>8,'sep'=>9,'sept'=>9,'september'=>9,
        'oct'=>10,'october'=>10,'nov'=>11,'november'=>11,'dec'=>12,'december'=>12,
    ];
    return $map[strtolower($name)] ?? null;
}

// ── Full-column profiling (Data Analyst approach) ──────────────────────────────

/**
 * Profile all raw values in a column and return statistics + planned normalizations.
 *
 * Mirrors the normalization rules in cleanValueByType() so the user can see
 * exactly what will happen to their data before committing the import.
 *
 * @param array  $rawValues  All raw string values for this column (from every row)
 * @param string $colType    Inferred SQL type
 * @param string $colLabel   Original header label from the file
 * @param string $colName    Sanitised DB column name
 * @return array Profile object
 */
function profileColumn(array $rawValues, string $colType, string $colLabel, string $colName): array
{
    static $semanticNullDates = [
        'n/a','#n/a','#value!','#ref!','tbd','tbc','n.a','na','none',
        '-','0','drop','cancel','cancelled','hold','pending','void',
        'blank','n/d','nd','nil','#na','#n/d','delete','deleted',
    ];
    static $booleanFlags = ['x','v','y','yes','true','done','ok','✓','√','■','●'];

    $total      = 0;
    $nullCount  = 0;
    $uniqueMap  = [];  // value => count, capped at 500 for memory
    $numVals    = [];  // numeric values for min/max (capped at 10000)
    $dateMin    = null;
    $dateMax    = null;

    // Normalization counters and examples
    $normCounts   = [];
    $normExamples = [];

    foreach ($rawValues as $raw) {
        $v = trim((string)$raw);
        $total++;

        if ($v === '' || strcasecmp($v, 'null') === 0) {
            $nullCount++;
            continue;
        }

        $lower = strtolower($v);

        // Track unique values (capped to limit memory on very wide datasets)
        if (!isset($uniqueMap[$v])) {
            if (count($uniqueMap) < 500) {
                $uniqueMap[$v] = 1;
            }
        } else {
            $uniqueMap[$v]++;
        }

        $type = strtoupper(trim($colType));

        if ($type === 'DATE') {
            // Excel zero-date
            if (preg_match('/^\d{1,2}\/0\/\d{4}$/', $v)) {
                $key = 'excel_zero_date';
                $normCounts[$key]   = ($normCounts[$key]   ?? 0) + 1;
                if (!isset($normExamples[$key]) || count($normExamples[$key]) < 3) {
                    $normExamples[$key][] = $v;
                }
            // Semantic null placeholder
            } elseif (in_array($lower, $semanticNullDates, true)) {
                $key = 'semantic_null';
                $normCounts[$key]   = ($normCounts[$key]   ?? 0) + 1;
                if (!isset($normExamples[$key]) || count($normExamples[$key]) < 3) {
                    $normExamples[$key][] = $v;
                }
            // Valid date — track min/max
            } elseif (looksLikeDate($v)) {
                $parsed = tryParseAnyDate($v);
                if ($parsed !== null) {
                    if ($dateMin === null || $parsed < $dateMin) $dateMin = $parsed;
                    if ($dateMax === null || $parsed > $dateMax) $dateMax = $parsed;
                }
            }

        } elseif ($type === 'DECIMAL(18,4)' || $type === 'SMALLINT UNSIGNED'
               || $type === 'INT UNSIGNED'   || $type === 'BIGINT UNSIGNED') {

            if (in_array($lower, $booleanFlags, true)) {
                $key = 'boolean_flag';
                $normCounts[$key]   = ($normCounts[$key]   ?? 0) + 1;
                if (!isset($normExamples[$key]) || count($normExamples[$key]) < 3) {
                    $normExamples[$key][] = $v;
                }
            } elseif (preg_match('/[A-Za-z]/', $v) && preg_match('/\d/', $v)) {
                $key = 'reference_code';
                $normCounts[$key]   = ($normCounts[$key]   ?? 0) + 1;
                if (!isset($normExamples[$key]) || count($normExamples[$key]) < 3) {
                    $normExamples[$key][] = $v;
                }
            } elseif (preg_match('/[A-Za-z]/', $v)) {
                $key = 'text_in_numeric';
                $normCounts[$key]   = ($normCounts[$key]   ?? 0) + 1;
                if (!isset($normExamples[$key]) || count($normExamples[$key]) < 3) {
                    $normExamples[$key][] = $v;
                }
            } else {
                $stripped = preg_replace('/[Rp$€£,\s]/', '', $v);
                $stripped = preg_replace('/\b(IDR|USD|EUR|GBP)\b/i', '', $stripped);
                if (is_numeric(trim($stripped)) && count($numVals) < 10000) {
                    $numVals[] = (float)trim($stripped);
                }
            }
        }
    }

    // Top 5 values by frequency
    arsort($uniqueMap);
    $topValues = [];
    $i = 0;
    foreach ($uniqueMap as $val => $count) {
        if ($i >= 5) break;
        $topValues[] = ['value' => $val, 'count' => $count];
        $i++;
    }

    // Build normalization list (labels for the UI)
    static $normLabels = [
        'excel_zero_date' => 'Excel zero-date (e.g. 1/0/1900)',
        'semantic_null'   => 'Semantic empty placeholder',
        'boolean_flag'    => 'Boolean flag (x / v / y)',
        'reference_code'  => 'Reference/code value in numeric column',
        'text_in_numeric' => 'Text value in numeric column',
    ];
    static $normActions = [
        'excel_zero_date' => '→ NULL (silently)',
        'semantic_null'   => '→ NULL (silently)',
        'boolean_flag'    => '→ 1',
        'reference_code'  => '→ NULL (silently)',
        'text_in_numeric' => '→ NULL (silently)',
    ];

    $normalizations = [];
    foreach ($normCounts as $key => $count) {
        $normalizations[] = [
            'type'     => $key,
            'label'    => $normLabels[$key]  ?? $key,
            'action'   => $normActions[$key] ?? '→ transformed',
            'count'    => $count,
            'examples' => $normExamples[$key] ?? [],
        ];
    }

    $filled = $total - $nullCount;
    $profile = [
        'col_name'       => $colName,
        'label'          => $colLabel,
        'col_type'       => $colType,
        'total'          => $total,
        'null_count'     => $nullCount,
        'fill_count'     => $filled,
        'fill_pct'       => $total > 0 ? round($filled / $total * 100, 1) : 0.0,
        'unique_count'   => count($uniqueMap),
        'top_values'     => $topValues,
        'normalizations' => $normalizations,
        'norm_total'     => array_sum($normCounts),
    ];

    if (!empty($numVals)) {
        $profile['num_min'] = min($numVals);
        $profile['num_max'] = max($numVals);
    }
    if ($dateMin !== null) {
        $profile['date_min'] = $dateMin;
        $profile['date_max'] = $dateMax;
    }

    return $profile;
}
