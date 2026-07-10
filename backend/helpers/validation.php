<?php

function validateRequired(array $data, array $fields): array {
    $errors = [];
    foreach ($fields as $field) {
        if (!isset($data[$field]) || trim((string)$data[$field]) === '') {
            $errors[$field] = "Field '{$field}' is required.";
        }
    }
    return $errors;
}

/**
 * Sanitasi string untuk disimpan ke DB.
 * Hanya trim + strip_tags. TIDAK htmlspecialchars — itu untuk HTML output, bukan storage.
 * JSON output PHP sudah aman secara default (json_encode escape karakter khusus).
 */
function sanitizeString($value, int $maxLen = 0): ?string {
    if ($value === null) return null;
    $s = strip_tags(trim((string)$value));
    if ($s === '') return null;
    if ($maxLen > 0 && mb_strlen($s) > $maxLen) {
        $s = mb_substr($s, 0, $maxLen);
    }
    return $s;
}

function sanitizeInt($value): ?int {
    $v = filter_var($value, FILTER_VALIDATE_INT);
    return $v !== false ? (int)$v : null;
}

function sanitizeFloat($value): ?float {
    if ($value === null || $value === '') return null;
    // Hapus koma ribuan sebelum validasi (format Excel: 1,234,567.89)
    $clean = str_replace(',', '', (string)$value);
    $v = filter_var($clean, FILTER_VALIDATE_FLOAT);
    return $v !== false ? (float)$v : null;
}

function sanitizeEmail(string $value): ?string {
    $v = filter_var(trim($value), FILTER_VALIDATE_EMAIL);
    return $v !== false ? strtolower($v) : null;
}

/**
 * Parse tanggal dari berbagai format ke Y-m-d.
 * Hanya menerima format eksplisit — menolak string ambigu.
 */
function sanitizeDate(?string $value): ?string {
    if ($value === null || trim($value) === '') return null;
    $value = trim($value);

    // Format prioritas: coba yang paling eksplisit dulu
    $formats = [
        'Y-m-d',        // 2024-01-31
        'd/m/Y',        // 31/01/2024
        'm/d/Y',        // 01/31/2024
        'd-m-Y',        // 31-01-2024
        'd/m/y',        // 31/01/24
        'Y/m/d',        // 2024/01/31
        'd M Y',        // 31 Jan 2024
        'd F Y',        // 31 January 2024
        'M d, Y',       // Jan 31, 2024
        'F d, Y',       // January 31, 2024
        'Ymd',          // 20240131
    ];

    foreach ($formats as $fmt) {
        $dt = DateTime::createFromFormat($fmt, $value);
        if ($dt !== false) {
            // Pastikan tidak ada overflow (e.g., 32/01/2024)
            $errors = DateTime::getLastErrors();
            if (!empty($errors['warning_count']) || !empty($errors['error_count'])) {
                continue;
            }
            return $dt->format('Y-m-d');
        }
    }

    // Untuk Excel serial number (angka bulat seperti 45292)
    if (is_numeric($value) && (int)$value > 25569 && (int)$value < 100000) {
        // Excel date serial: days since 1900-01-01 (dengan koreksi leap year bug Excel)
        $unixTimestamp = ((int)$value - 25569) * 86400;
        $dt = new DateTime('@' . $unixTimestamp);
        return $dt->format('Y-m-d');
    }

    return null; // Format tidak dikenal — simpan null, jangan guess
}

function sanitizeLat($value): ?float {
    $f = sanitizeFloat($value);
    if ($f === null) return null;
    if ($f < -90.0 || $f > 90.0) return null; // out of range
    return round($f, 7);
}

function sanitizeLng($value): ?float {
    $f = sanitizeFloat($value);
    if ($f === null) return null;
    if ($f < -180.0 || $f > 180.0) return null; // out of range
    return round($f, 7);
}

function paginationParams(): array {
    $page  = max(1, (int)($_GET['page']  ?? 1));
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 20)));
    return [$page, $limit, ($page - 1) * $limit];
}

function allowedSortColumn(string $col, array $allowed, string $default): string {
    return in_array($col, $allowed, true) ? $col : $default;
}

function allowedSortDir(string $dir): string {
    return strtoupper($dir) === 'DESC' ? 'DESC' : 'ASC';
}
