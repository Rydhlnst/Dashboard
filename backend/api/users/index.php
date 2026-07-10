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

$search = trim($_GET['search'] ?? '');
$statusFilter = strtolower(trim($_GET['status'] ?? ''));
$conditions = [];
$params = [];

if ($search !== '') {
    $conditions[] = '(name LIKE ? OR email LIKE ?)';
    $like = "%{$search}%";
    $params[] = $like;
    $params[] = $like;
}

if ($statusFilter !== '' && in_array($statusFilter, ['active', 'inactive', 'pending'], true)) {
    $conditions[] = 'status = ?';
    $params[] = $statusFilter;
}

$where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

$countStmt = $db->prepare("SELECT COUNT(*) FROM users {$where}");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$dataStmt = $db->prepare(
    "SELECT id, name, email, role, status, created_at, updated_at FROM users {$where} ORDER BY created_at DESC LIMIT ? OFFSET ?"
);
$dataStmt->execute(array_merge($params, [$limit, $offset]));
$rows = $dataStmt->fetchAll();

foreach ($rows as &$row) {
    $row['id'] = (int)$row['id'];
}
unset($row);

jsonPaginated($rows, $total, $page, $limit);
