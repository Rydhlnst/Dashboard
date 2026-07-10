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

$label = trim($body['label'] ?? '');
if ($label === '') {
    jsonError('Column label is required.', 422);
}

// Auto-generate field_key from label if not provided
$fieldKey = trim($body['field_key'] ?? '');
if ($fieldKey === '') {
    $fieldKey = strtolower(preg_replace('/[^a-z0-9]+/i', '_', $label));
    $fieldKey = trim($fieldKey, '_');
    $fieldKey = 'custom_' . $fieldKey;
}
$fieldKey = substr($fieldKey, 0, 100);

$datasetType = in_array($body['dataset_type'] ?? 'all', ['all','closing','filter900','refinement'], true)
    ? $body['dataset_type']
    : 'all';

$validTypes = ['text','number','decimal','percentage','date','datetime','boolean','select','multi_select','textarea','url'];
$fieldType = in_array($body['field_type'] ?? 'text', $validTypes, true) ? $body['field_type'] : 'text';

$optionsJson = null;
if (in_array($fieldType, ['select','multi_select']) && !empty($body['options'])) {
    $optionsJson = json_encode(array_values((array)$body['options']), JSON_UNESCAPED_UNICODE);
}

$db = getDB();

// Check uniqueness
$check = $db->prepare("SELECT id FROM column_definitions WHERE field_key = ? AND dataset_type = ?");
$check->execute([$fieldKey, $datasetType]);
if ($check->fetch()) {
    jsonError("Field key '{$fieldKey}' already exists for dataset '{$datasetType}'.", 409);
}

// Get next sort order
$maxOrder = (int)$db->query("SELECT COALESCE(MAX(sort_order),0) FROM column_definitions")->fetchColumn();

$stmt = $db->prepare("
    INSERT INTO column_definitions
        (dataset_type, field_key, label, field_type, is_system, is_visible, is_filterable, is_chartable,
         is_required, default_value, options_json, sort_order, column_group, created_at, updated_at)
    VALUES (?,?,?,?,0,?,?,?,?,?,?,?,?,NOW(),NOW())
");
$stmt->execute([
    $datasetType,
    $fieldKey,
    substr($label, 0, 255),
    $fieldType,
    isset($body['is_visible'])    ? ((bool)$body['is_visible']    ? 1 : 0) : 1,
    isset($body['is_filterable']) ? ((bool)$body['is_filterable'] ? 1 : 0) : 0,
    isset($body['is_chartable'])  ? ((bool)$body['is_chartable']  ? 1 : 0) : 0,
    isset($body['is_required'])   ? ((bool)$body['is_required']   ? 1 : 0) : 0,
    isset($body['default_value']) ? substr(trim($body['default_value']), 0, 500) : null,
    $optionsJson,
    $maxOrder + 10,
    isset($body['column_group']) ? substr(trim($body['column_group']), 0, 100) : null,
]);
$newId = (int)$db->lastInsertId();

AuditLog::log($admin['id'], 'create_column', 'column_definition', (string)$newId,
    "Created column '{$fieldKey}' (label: {$label}) for dataset '{$datasetType}'");

jsonSuccess(['id' => $newId, 'field_key' => $fieldKey], 'Column created successfully.', 201);
