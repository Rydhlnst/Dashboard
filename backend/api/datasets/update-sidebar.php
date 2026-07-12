<?php
/**
 * POST /api/datasets/update-sidebar.php
 *
 * Updates sidebar visibility and label for a dataset.
 *
 * JSON body:
 *   id              : int     (required)
 *   show_in_sidebar : bool
 *   page_label      : string|null
 *   sidebar_sort    : int     (optional, default 100)
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

requireAdmin();

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    $body = [];
}

$id            = isset($body['id'])             ? (int)$body['id']                 : 0;
$showInSidebar = isset($body['show_in_sidebar']) ? (int)(bool)$body['show_in_sidebar'] : 0;
$pageLabel     = isset($body['page_label'])      ? trim((string)$body['page_label'])   : null;
$sidebarSort   = isset($body['sidebar_sort'])    ? (int)$body['sidebar_sort']           : 100;

if ($id <= 0) {
    jsonError('Dataset ID required.', 422);
}

try {
    $db = getDB();

    $stmt = $db->prepare("SELECT id FROM datasets WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        jsonError('Dataset not found.', 404);
    }

    $db->prepare(
        "UPDATE datasets SET show_in_sidebar=?, page_label=?, sidebar_sort=? WHERE id=?"
    )->execute([
        $showInSidebar,
        ($pageLabel !== '' && $pageLabel !== null) ? $pageLabel : null,
        $sidebarSort,
        $id,
    ]);

    jsonSuccess([
        'id'             => $id,
        'show_in_sidebar'=> (bool)$showInSidebar,
        'page_label'     => ($pageLabel !== '' && $pageLabel !== null) ? $pageLabel : null,
        'sidebar_sort'   => $sidebarSort,
    ]);

} catch (Throwable $e) {
    jsonError('Update failed: ' . $e->getMessage(), 500);
}
