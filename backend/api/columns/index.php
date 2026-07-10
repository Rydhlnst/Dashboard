<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed.', 405);
}

requireAuth();

$db = getDB();

$conditions = ['c.is_archived = 0'];
$params = [];

$datasetType = trim($_GET['dataset_type'] ?? '');
if ($datasetType !== '') {
    // Return columns for 'all' + the specific dataset
    $conditions[] = "(c.dataset_type = 'all' OR c.dataset_type = ?)";
    $params[] = $datasetType;
}

$where = 'WHERE ' . implode(' AND ', $conditions);

$sql = "SELECT c.* FROM column_definitions c {$where} ORDER BY c.sort_order ASC, c.id ASC";
$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$row) {
    $row['id']          = (int)$row['id'];
    $row['is_system']   = (bool)$row['is_system'];
    $row['is_visible']  = (bool)$row['is_visible'];
    $row['is_filterable'] = (bool)$row['is_filterable'];
    $row['is_chartable']  = (bool)$row['is_chartable'];
    $row['is_required']   = (bool)$row['is_required'];
    $row['is_archived']   = (bool)$row['is_archived'];
    $row['sort_order']    = (int)$row['sort_order'];
    if ($row['options_json'] !== null) {
        $row['options_json'] = json_decode($row['options_json'], true);
    }
}
unset($row);

jsonSuccess($rows, 'Column definitions loaded.');
