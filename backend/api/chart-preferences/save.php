<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$user = requireAuth();
$body = getRequestBody();

$errors = validateRequired($body, ['chart_key', 'chart_type']);
if (!empty($errors)) {
    jsonError('Validation failed.', 422, $errors);
}

$allowedChartTypes = ['bar','line','area','pie','donut','radar','radial','scatter'];
$chartType = strtolower(sanitizeString($body['chart_type']) ?? 'bar');
if (!in_array($chartType, $allowedChartTypes, true)) {
    jsonError('Invalid chart_type.', 422);
}

$chartKey   = sanitizeString($body['chart_key'] ?? '');
$xAxis      = sanitizeString($body['x_axis'] ?? null);
$yAxis      = sanitizeString($body['y_axis'] ?? null);
$groupBy    = sanitizeString($body['group_by'] ?? null);
$filters    = isset($body['filters']) && is_array($body['filters'])
              ? json_encode($body['filters'], JSON_UNESCAPED_UNICODE)
              : null;

$db = getDB();

// Upsert
$stmt = $db->prepare(
    'INSERT INTO user_chart_preferences (user_id, chart_key, chart_type, x_axis, y_axis, group_by, filters_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       chart_type   = VALUES(chart_type),
       x_axis       = VALUES(x_axis),
       y_axis       = VALUES(y_axis),
       group_by     = VALUES(group_by),
       filters_json = VALUES(filters_json),
       updated_at   = NOW()'
);
$stmt->execute([$user['id'], $chartKey, $chartType, $xAxis, $yAxis, $groupBy, $filters]);

jsonSuccess(['chart_key' => $chartKey, 'chart_type' => $chartType], 'Chart preference saved.');
