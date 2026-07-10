<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed.', 405);
}

$user = requireAuth();
$db   = getDB();

$stmt = $db->prepare(
    'SELECT id, chart_key, chart_type, x_axis, y_axis, group_by, filters_json, updated_at
     FROM user_chart_preferences
     WHERE user_id = ?
     ORDER BY chart_key ASC'
);
$stmt->execute([$user['id']]);
$rows = $stmt->fetchAll();

foreach ($rows as &$row) {
    $row['id']          = (int)$row['id'];
    $row['filters_json'] = $row['filters_json'] ? json_decode($row['filters_json'], true) : null;
}
unset($row);

jsonSuccess($rows);
