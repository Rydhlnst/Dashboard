<?php
/**
 * GET /api/datasets/sidebar.php
 *
 * Returns datasets that are marked show_in_sidebar=1,
 * ordered by sidebar_sort ASC then name ASC.
 * Used by the frontend sidebar to render dynamic nav items.
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

    // Show all datasets that are enabled for sidebar; fallback if columns not migrated yet
    try {
        $rows = $db->query(
            "SELECT id, name, page_label, sidebar_sort
               FROM datasets
              WHERE show_in_sidebar = 1
              ORDER BY created_at DESC"
        )->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $inner) {
        $rows = $db->query(
            "SELECT id, name, NULL AS page_label, 100 AS sidebar_sort
               FROM datasets
              ORDER BY created_at DESC"
        )->fetchAll(PDO::FETCH_ASSOC);
    }

    $items = array_map(function ($row) {
        return [
            'id'           => (int)$row['id'],
            'name'         => $row['name'],
            'page_label'   => $row['page_label'],
            'sidebar_sort' => (int)$row['sidebar_sort'],
        ];
    }, $rows);

    jsonSuccess($items);

} catch (Throwable $e) {
    jsonError('Failed to load sidebar items: ' . $e->getMessage(), 500);
}
