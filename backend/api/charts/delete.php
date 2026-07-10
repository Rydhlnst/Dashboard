<?php
/**
 * DELETE /api/charts/delete.php?id=1
 *
 * Delete a saved chart by id.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonError('Method not allowed.', 405);
}

requireAdmin();

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) jsonError('id is required.', 400);

try {
    $db   = getDB();
    $stmt = $db->prepare("DELETE FROM saved_charts WHERE id=?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        jsonError("Chart #{$id} not found.", 404);
    }

    jsonSuccess(['id' => $id], 'Chart deleted.');

} catch (Throwable $e) {
    jsonError('Failed to delete chart: ' . $e->getMessage(), 500);
}
