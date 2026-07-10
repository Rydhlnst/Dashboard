<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed.', 405);
}

requireAuth();

$id = sanitizeInt($_GET['id'] ?? null);
if (!$id) {
    jsonError('Invalid or missing project ID.', 400);
}

$db   = getDB();
$stmt = $db->prepare('SELECT * FROM project_records WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$row  = $stmt->fetch();

if (!$row) {
    jsonError('Project not found.', 404);
}

$row['id']              = (int)$row['id'];
$row['import_batch_id'] = $row['import_batch_id'] ? (int)$row['import_batch_id'] : null;
$row['blocking']        = (bool)$row['blocking'];
$row['capex']           = $row['capex'] !== null ? (float)$row['capex'] : null;
$row['lat']             = $row['lat']   !== null ? (float)$row['lat']   : null;
$row['lng']             = $row['lng']   !== null ? (float)$row['lng']   : null;

jsonSuccess($row);
