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

// KPI counts
$totalProjects = (int)$db->query('SELECT COUNT(*) FROM project_records')->fetchColumn();

$stmt = $db->prepare("SELECT COUNT(*) FROM project_records WHERE LOWER(status_project) IN ('completed','done','selesai')");
$stmt->execute();
$totalCompleted = (int)$stmt->fetchColumn();

$totalBlocking = (int)$db->query('SELECT COUNT(*) FROM project_records WHERE blocking = 1')->fetchColumn();
$totalInProgress = $totalProjects - $totalCompleted - $totalBlocking;

// Group-by helpers
function groupBy(PDO $db, string $column): array {
    $stmt = $db->prepare(
        "SELECT COALESCE({$column}, 'Unknown') AS label, COUNT(*) AS value
         FROM project_records
         GROUP BY {$column}
         ORDER BY value DESC
         LIMIT 50"
    );
    $stmt->execute();
    $rows = $stmt->fetchAll();
    return array_map(fn($r) => ['label' => $r['label'], 'value' => (int)$r['value']], $rows);
}

$summary = [
    'total_projects'          => $totalProjects,
    'total_completed'         => $totalCompleted,
    'total_blocking'          => $totalBlocking,
    'total_in_progress'       => max(0, $totalInProgress),
    'by_status_project'       => groupBy($db, 'status_project'),
    'by_province'             => groupBy($db, 'province'),
    'by_mitra_impl'           => groupBy($db, 'mitra_impl'),
    'by_project_category'     => groupBy($db, 'project_category'),
    'by_rfs_month'            => groupBy($db, 'rfs_month'),
    'by_atp_status'           => groupBy($db, 'atp_status'),
    'by_baut_status'          => groupBy($db, 'baut_status'),
    'by_bast_status'          => groupBy($db, 'bast_status'),
];

jsonSuccess($summary);
