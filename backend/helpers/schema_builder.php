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

    $n        = count($values);
    $dateHits = 0;
    $numHits  = 0;
    $decHits  = 0;
    $maxLen   = 0;
    $allYear  = true;

    foreach ($values as $v) {
        $maxLen = max($maxLen, mb_strlen($v));
        if (looksLikeDate($v)) $dateHits++;

        // Strip currency/thousand-separator artefacts before numeric test
        $stripped = preg_replace('/[Rp$€£,\s]/', '', $v);
        $stripped = preg_replace('/\b(IDR|USD|EUR|GBP)\b/i', '', $stripped);
        $stripped = trim($stripped);
        if ($stripped !== '' && is_numeric($stripped)) {
            $numHits++;
            if (strpos($stripped, '.') !== false) $decHits++;
        }

        if (!preg_match('/^(19|20)\d{2}$/', $v)) $allYear = false;
    }

    $pct = function (int $hits) use ($n): float {
        return $n > 0 ? ($hits / $n) : 0.0;
    };

    if ($pct($dateHits) >= 0.8)                        return 'DATE';
    if ($allYear && $pct($numHits) >= 0.95)            return 'SMALLINT UNSIGNED';
    if ($pct($numHits) >= 0.8)                         return 'DECIMAL(18,4)';
    if ($maxLen > 500)                                  return 'TEXT';
    if ($maxLen > 255)                                  return 'VARCHAR(500)';
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
    $defs = [];
    foreach ($columns as $col) {
        $safe = sanitizeColName($col['col_name']);
        if ($safe === '') continue;
        $type = whitelistType($col['col_type']);
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
         . ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
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
 * @return array [$cleanedValue, $warnings[], $errors[]]
 */
function cleanValueByType(string $rawVal, string $colType): array
{
    $val      = trim($rawVal);
    $warnings = [];
    $errors   = [];

    // Treat empty / dash as NULL
    if ($val === '' || $val === '-') return [null, $warnings, $errors];

    $type = strtoupper(trim($colType));

    if ($type === 'DATE') {
        $parsed = tryParseAnyDate($val);
        if ($parsed !== null) return [$parsed, $warnings, $errors];
        $warnings[] = "Could not parse date '{$val}' — stored as empty.";
        return [null, $warnings, $errors];
    }

    if ($type === 'DECIMAL(18,4)') {
        $stripped = preg_replace('/[Rp$€£,\s]/', '', $val);
        $stripped = preg_replace('/\b(IDR|USD|EUR|GBP)\b/i', '', $stripped);
        $stripped = trim($stripped);
        if (is_numeric($stripped)) return [round((float)$stripped, 4), $warnings, $errors];
        $warnings[] = "Could not parse number '{$val}' — stored as empty.";
        return [null, $warnings, $errors];
    }

    if ($type === 'SMALLINT UNSIGNED') {
        $stripped = preg_replace('/\D/', '', $val);
        if ($stripped !== '') return [(int)$stripped, $warnings, $errors];
        $warnings[] = "Could not parse integer '{$val}' — stored as empty.";
        return [null, $warnings, $errors];
    }

    if ($type === 'INT UNSIGNED' || $type === 'BIGINT UNSIGNED') {
        $stripped = preg_replace('/[^0-9]/', '', $val);
        if ($stripped !== '') return [(int)$stripped, $warnings, $errors];
        $warnings[] = "Could not parse integer '{$val}' — stored as empty.";
        return [null, $warnings, $errors];
    }

    if ($type === 'TEXT' || $type === 'LONGTEXT') {
        $val = strip_tags($val);
        $val = preg_replace('/\s+/', ' ', $val);
        return [$val, $warnings, $errors];
    }

    // VARCHAR(255) / VARCHAR(500) / default
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
