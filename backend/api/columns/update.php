<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();

$id = (int)($_GET['id'] ?? 0);
if ($id < 1) {
    jsonError('Column ID required.', 400);
}

$body = getRequestBody();

$db = getDB();
$col = $db->prepare("SELECT * FROM column_definitions WHERE id = ?")->execute([$id])
    ? $db->prepare("SELECT * FROM column_definitions WHERE id = ?") : null;

$stmt = $db->prepare("SELECT * FROM column_definitions WHERE id = ?");
$stmt->execute([$id]);
$col = $stmt->fetch();
if (!$col) {
    jsonError('Column not found.', 404);
}

$updates = [];
$params  = [];

$updatable = ['label','column_group','is_visible','is_filterable','is_chartable','is_required','default_value'];

if (isset($body['label'])) {
    $updates[] = 'label = ?';
    $params[]  = substr(trim($body['label']), 0, 255);
}
if (isset($body['column_group'])) {
    $updates[] = 'column_group = ?';
    $params[]  = substr(trim($body['column_group']), 0, 100);
}
foreach (['is_visible','is_filterable','is_chartable','is_required'] as $flag) {
    if (isset($body[$flag])) {
        $updates[] = "{$flag} = ?";
        $params[]  = (bool)$body[$flag] ? 1 : 0;
    }
}
if (array_key_exists('default_value', $body)) {
    $updates[] = 'default_value = ?';
    $params[]  = $body['default_value'] !== null ? substr(trim($body['default_value']), 0, 500) : null;
}

// Options only for select types (non-system columns)
if (isset($body['options']) && in_array($col['field_type'], ['select','multi_select'])) {
    $updates[] = 'options_json = ?';
    $params[]  = json_encode(array_values((array)$body['options']), JSON_UNESCAPED_UNICODE);
}

if (empty($updates)) {
    jsonError('No updatable fields provided.', 422);
}

$updates[] = 'updated_at = NOW()';
$params[]  = $id;

$db->prepare("UPDATE column_definitions SET " . implode(', ', $updates) . " WHERE id = ?")->execute($params);

AuditLog::log($admin['id'], 'update_column', 'column_definition', (string)$id,
    "Updated column '{$col['field_key']}': " . json_encode($body, JSON_UNESCAPED_UNICODE));

jsonSuccess(['id' => $id], 'Column updated.');
