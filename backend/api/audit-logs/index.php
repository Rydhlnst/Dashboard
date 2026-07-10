<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed.', 405);
}

requireAdmin();

$db = getDB();

[$page, $limit, $offset] = paginationParams();

$conditions = [];
$params     = [];

$search = trim($_GET['search'] ?? '');
if ($search !== '') {
    $conditions[] = "(al.action LIKE ? OR al.entity LIKE ? OR al.description LIKE ? OR u.name LIKE ?)";
    $like = "%{$search}%";
    array_push($params, $like, $like, $like, $like);
}

$userId = (int)($_GET['user_id'] ?? 0);
if ($userId > 0) {
    $conditions[] = 'al.user_id = ?';
    $params[] = $userId;
}

$action = trim($_GET['action'] ?? '');
if ($action !== '') {
    $conditions[] = 'al.action = ?';
    $params[] = $action;
}

$dateFrom = trim($_GET['date_from'] ?? '');
if ($dateFrom !== '') {
    $conditions[] = 'al.created_at >= ?';
    $params[] = $dateFrom . ' 00:00:00';
}
$dateTo = trim($_GET['date_to'] ?? '');
if ($dateTo !== '') {
    $conditions[] = 'al.created_at <= ?';
    $params[] = $dateTo . ' 23:59:59';
}

$where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

$countSql = "SELECT COUNT(*) FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id {$where}";
$stmt = $db->prepare($countSql);
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

$dataSql = "SELECT al.*, u.name AS user_name, u.email AS user_email
            FROM audit_logs al
            LEFT JOIN users u ON u.id = al.user_id
            {$where}
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?";
$stmt = $db->prepare($dataSql);
$stmt->execute(array_merge($params, [$limit, $offset]));
$rows = $stmt->fetchAll();

foreach ($rows as &$row) {
    $row['id']      = (int)$row['id'];
    $row['user_id'] = $row['user_id'] ? (int)$row['user_id'] : null;
}
unset($row);

jsonPaginated($rows, $total, $page, $limit);
