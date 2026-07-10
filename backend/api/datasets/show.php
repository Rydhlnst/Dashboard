<?php
/**
 * GET /api/datasets/show.php?id=1
 *
 * Returns a single dataset with full columns_schema.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed.', 405);
}

requireAdmin();

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) jsonError('id is required.', 400);

try {
    $db   = getDB();
    $stmt = $db->prepare("SELECT * FROM datasets WHERE id=? LIMIT 1");
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) jsonError("Dataset #{$id} not found.", 404);

    $schema = json_decode($row['columns_schema'] ?? '[]', true) ?? [];

    jsonSuccess([
        'id'              => (int)$row['id'],
        'name'            => $row['name'],
        'slug'            => $row['slug'],
        'table_name'      => $row['table_name'],
        'columns_schema'  => $schema,
        'primary_key_col' => $row['primary_key_col'],
        'column_count'    => count($schema),
        'row_count'       => (int)$row['row_count'],
        'created_at'      => $row['created_at'],
        'updated_at'      => $row['updated_at'],
    ]);

} catch (Throwable $e) {
    jsonError('Failed to load dataset: ' . $e->getMessage(), 500);
}
