<?php
/**
 * GET /api/datasets/index.php
 *
 * Returns all dynamic datasets ordered by newest first.
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

try {
    $db = getDB();

    // Fallback if sidebar columns haven't been migrated yet
    try {
        $rows = $db->query(
            "SELECT id, name, slug, table_name, columns_schema, primary_key_col,
                    page_label, show_in_sidebar, sidebar_sort,
                    row_count, created_by, created_at, updated_at
               FROM datasets
              ORDER BY created_at DESC"
        )->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $inner) {
        $rows = $db->query(
            "SELECT id, name, slug, table_name, columns_schema, primary_key_col,
                    NULL AS page_label, 0 AS show_in_sidebar, 100 AS sidebar_sort,
                    row_count, created_by, created_at, updated_at
               FROM datasets
              ORDER BY created_at DESC"
        )->fetchAll(PDO::FETCH_ASSOC);
    }

    $datasets = [];
    foreach ($rows as $row) {
        $schema = json_decode($row['columns_schema'] ?? '[]', true) ?? [];
        $datasets[] = [
            'id'              => (int)$row['id'],
            'name'            => $row['name'],
            'slug'            => $row['slug'],
            'table_name'      => $row['table_name'],
            'primary_key_col' => $row['primary_key_col'],
            'page_label'      => $row['page_label'],
            'show_in_sidebar' => (bool)$row['show_in_sidebar'],
            'sidebar_sort'    => (int)$row['sidebar_sort'],
            'column_count'    => count($schema),
            'row_count'       => (int)$row['row_count'],
            'created_at'      => $row['created_at'],
            'updated_at'      => $row['updated_at'],
        ];
    }

    jsonSuccess(['datasets' => $datasets]);

} catch (Throwable $e) {
    jsonError('Failed to load datasets: ' . $e->getMessage(), 500);
}
