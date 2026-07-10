<?php
/**
 * GET /api/charts/list.php
 *
 * List all saved charts, joined with their dataset name.
 * Optional filter: ?dataset_id=1
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json; charset=utf-8');

requireAdmin();

$datasetId = (int)($_GET['dataset_id'] ?? 0);

try {
    $db = getDB();

    $sql = "SELECT sc.*, d.name AS dataset_name, d.table_name
              FROM saved_charts sc
              LEFT JOIN datasets d ON d.id = sc.dataset_id";

    $params = [];
    if ($datasetId > 0) {
        $sql .= " WHERE sc.dataset_id = ?";
        $params[] = $datasetId;
    }

    $sql .= " ORDER BY sc.created_at DESC";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $charts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Cast numeric fields
    foreach ($charts as &$c) {
        $c['id']         = (int)$c['id'];
        $c['dataset_id'] = (int)$c['dataset_id'];
        $c['limit_rows'] = (int)$c['limit_rows'];
    }
    unset($c);

    jsonSuccess($charts);

} catch (Throwable $e) {
    jsonError('Failed to list charts: ' . $e->getMessage(), 500);
}
