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
$rows = $db->query("SELECT * FROM settings ORDER BY id ASC")->fetchAll();

foreach ($rows as &$row) {
    $row['id'] = (int)$row['id'];
}
unset($row);

jsonSuccess($rows, 'Settings loaded.');
