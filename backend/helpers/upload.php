<?php

define('UPLOAD_MAX_SIZE', 10 * 1024 * 1024); // 10MB
define('UPLOAD_TEMP_DIR', __DIR__ . '/../uploads/temp/');
define('ALLOWED_EXCEL_MIME', [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel',                                           // xls
    'application/octet-stream',
    'text/csv',
    'text/plain',
    'application/csv',
]);
define('ALLOWED_EXCEL_EXT', ['xlsx', 'xls', 'csv']);

function validateExcelUpload(array $file): ?string {
    if (!isset($file['tmp_name']) || $file['error'] !== UPLOAD_ERR_OK) {
        return 'File upload failed. Error code: ' . ($file['error'] ?? 'unknown');
    }
    if ($file['size'] > UPLOAD_MAX_SIZE) {
        return 'File size exceeds 10MB limit.';
    }
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ALLOWED_EXCEL_EXT, true)) {
        return 'Only .xlsx, .xls, and .csv files are allowed.';
    }
    return null;
}

function moveUploadToTemp(array $file): string {
    if (!is_dir(UPLOAD_TEMP_DIR)) {
        mkdir(UPLOAD_TEMP_DIR, 0750, true);
    }
    $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $tmpName  = uniqid('import_', true) . '.' . $ext;
    $destPath = UPLOAD_TEMP_DIR . $tmpName;
    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        throw new RuntimeException('Failed to move uploaded file.');
    }
    return $destPath;
}

function cleanupTempFile(string $path): void {
    if (file_exists($path)) {
        @unlink($path);
    }
}
