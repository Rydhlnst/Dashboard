<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAuth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../helpers/report_filter.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed.', 405);
}

requireAuth();

$db = getDB();

// Load settings from DB
$settingsStmt = $db->query("SELECT setting_key, setting_value FROM settings");
$settings = [];
foreach ($settingsStmt->fetchAll() as $row) {
    $settings[$row['setting_key']] = $row['setting_value'];
}

// Build dynamic SQL expressions from settings
$completedParts = [];
if (($settings['completed_uses_flag'] ?? '1') === '1') $completedParts[] = "p.progress_done_flag = '1'";
if (($settings['completed_uses_rfs']  ?? '1') === '1') $completedParts[] = "p.rfs_actual IS NOT NULL";
$completedExpr = $completedParts ? implode(' OR ', $completedParts) : '1=0';

$droppedParts = [];
if (($settings['dropped_uses_status_po'] ?? '1') === '1') $droppedParts[] = "LOWER(p.status_po) = 'drop'";
if (($settings['dropped_uses_flag_x']   ?? '1') === '1') $droppedParts[] = "p.progress_done_flag = 'x'";
$droppedExpr = $droppedParts ? implode(' OR ', $droppedParts) : '1=0';

$excludeCategory = $settings['issue_exclude_category'] ?? '01. RFS';
$issueParts = [
    "issue_category IS NOT NULL AND TRIM(issue_category) != '' AND TRIM(issue_category) != " . $db->quote($excludeCategory),
];
if (($settings['issue_check_pic_blocking'] ?? '1') === '1') {
    $issueParts[] = "TRIM(COALESCE(p.pic_blocking,'')) != ''";
}
if (($settings['issue_check_acceptance_blocking'] ?? '1') === '1') {
    $blockingFields = ['atp_blocking','lv_blocking','oac_blocking','qc_blocking','sqac_blocking','baut_blocking','bast_blocking'];
    foreach ($blockingFields as $bf) {
        $issueParts[] = "TRIM(COALESCE(p.{$bf},'')) != ''";
    }
}
$issueExpr = implode(' OR ', $issueParts);

// Build base WHERE from filters
$baseConditions = ['p.deleted_at IS NULL'];
$baseParams = [];

$filterMap = [
    'dataset_type'     => 'p.dataset_type',
    'status_po'        => 'p.status_po',
    'project_category' => 'p.project_category',
    'vendor_principle' => 'p.vendor_principle',
    'mitra_impl'       => 'p.mitra_impl',
    'nop'              => 'p.nop',
    'tp_detail'        => 'p.tp_detail',
    'rfs_month'        => 'p.rfs_month',
    'po_year'          => 'p.po_year',
    'province'         => 'p.province',
];

foreach ($filterMap as $param => $col) {
    $val = trim($_GET[$param] ?? '');
    if ($val !== '') {
        $baseConditions[] = "{$col} = ?";
        $baseParams[] = $val;
    }
}

applyReportDateFilter($baseConditions, $baseParams, 'p');

$progressStatus = trim($_GET['progress_status'] ?? '');
if ($progressStatus === 'Completed') {
    $baseConditions[] = "({$completedExpr})";
} elseif ($progressStatus === 'Dropped') {
    $baseConditions[] = "({$droppedExpr})";
} elseif ($progressStatus === 'Not Yet') {
    if (($settings['completed_uses_flag'] ?? '1') === '1') $baseConditions[] = "p.progress_done_flag NOT IN ('1','x')";
    if (($settings['completed_uses_rfs']  ?? '1') === '1') $baseConditions[] = "p.rfs_actual IS NULL";
    if (($settings['dropped_uses_status_po'] ?? '1') === '1') $baseConditions[] = "LOWER(COALESCE(p.status_po,'')) != 'drop'";
    if (($settings['dropped_uses_flag_x']   ?? '1') === '1') $baseConditions[] = "COALESCE(p.progress_done_flag,'') != 'x'";
}

$baseWhere = 'WHERE ' . implode(' AND ', $baseConditions);

// ── KPI Counts ────────────────────────────────────────────────────────────────
function countWith(PDO $db, string $where, array $params, string $extra = ''): int {
    $sql = "SELECT COUNT(*) FROM project_records p {$where}" . ($extra ? " AND ({$extra})" : '');
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return (int)$stmt->fetchColumn();
}

$total     = countWith($db, $baseWhere, $baseParams);
$completed = countWith($db, $baseWhere, $baseParams, $completedExpr);
$dropped   = countWith($db, $baseWhere, $baseParams, $droppedExpr);
$remaining = $total - $completed - $dropped;
if ($remaining < 0) $remaining = 0;
$progress_pct = $total > 0 ? round($completed / $total * 100, 2) : 0;

$totalIssues = countWith($db, $baseWhere, $baseParams, $issueExpr);

// Last update
$lastUpdate = $db->prepare("SELECT MAX(updated_at) FROM project_records p {$baseWhere}");
$lastUpdate->execute($baseParams);
$lastUpdateVal = $lastUpdate->fetchColumn();

// ── Group-by helper ────────────────────────────────────────────────────────────
function groupBy(PDO $db, string $column, string $where, array $params, int $limit = 20): array {
    $stmt = $db->prepare("
        SELECT COALESCE(NULLIF(TRIM(p.{$column}),''), 'Unknown') AS label, COUNT(*) AS value
        FROM project_records p {$where}
        GROUP BY label ORDER BY value DESC LIMIT {$limit}
    ");
    $stmt->execute($params);
    return array_map(fn($r) => ['label' => $r['label'], 'value' => (int)$r['value']], $stmt->fetchAll());
}

// Progress by month (RFS Actual month for completed)
$byMonthStmt = $db->prepare("
    SELECT COALESCE(p.rfs_month, DATE_FORMAT(p.rfs_actual, '%Y-%m')) AS month,
           COUNT(*) AS rfs_count,
           SUM(CASE WHEN p.progress_done_flag NOT IN ('1','x') AND p.rfs_actual IS NULL AND LOWER(COALESCE(p.status_po,''))!='drop' THEN 1 ELSE 0 END) AS ny_count
    FROM project_records p {$baseWhere}
    AND (p.rfs_month IS NOT NULL OR p.rfs_actual IS NOT NULL)
    GROUP BY month ORDER BY month ASC LIMIT 24
");
$byMonthStmt->execute($baseParams);
$byMonth = array_map(fn($r) => [
    'label' => $r['month'],
    'rfs'   => (int)$r['rfs_count'],
    'ny'    => (int)$r['ny_count'],
], $byMonthStmt->fetchAll());

// Top 10 pending — not completed and not dropped
$pendingExclusions = ["NOT ({$completedExpr})", "NOT ({$droppedExpr})"];
$pendingWhere = $baseWhere . ' AND ' . implode(' AND ', $pendingExclusions);
$pendingStmt = $db->prepare("
    SELECT p.id, p.pdid, p.site_name, p.project_category, p.nop, p.mitra_impl,
           p.issue_category, p.pic_blocking, p.progress_done_flag, p.rfs_actual
    FROM project_records p {$pendingWhere}
    ORDER BY p.updated_at ASC LIMIT 10
");
$pendingStmt->execute($baseParams);
$topPending = $pendingStmt->fetchAll();

// Financial totals (only for closing dataset or all)
$finStmt = $db->prepare("
    SELECT
        COALESCE(SUM(p.price_po),0)             AS total_price_po,
        COALESCE(SUM(p.price_po_to_be_claim),0) AS total_claim,
        COALESCE(SUM(p.price_bast),0)           AS total_bast,
        COALESCE(SUM(p.remaining_po),0)         AS total_remaining
    FROM project_records p {$baseWhere}
");
$finStmt->execute($baseParams);
$fin = $finStmt->fetch();

jsonSuccess([
    'kpi' => [
        'total'        => $total,
        'completed'    => $completed,
        'remaining'    => $remaining,
        'dropped'      => $dropped,
        'progress_pct' => $progress_pct,
        'issues'       => $totalIssues,
        'last_update'  => $lastUpdateVal,
    ],
    'financial' => [
        'total_price_po'  => (float)($fin['total_price_po']  ?? 0),
        'total_claim'     => (float)($fin['total_claim']     ?? 0),
        'total_bast'      => (float)($fin['total_bast']      ?? 0),
        'total_remaining' => (float)($fin['total_remaining'] ?? 0),
    ],
    'charts' => [
        'by_month'            => $byMonth,
        'by_project_category' => groupBy($db, 'project_category', $baseWhere, $baseParams, 20),
        'by_nop'              => groupBy($db, 'nop',              $baseWhere, $baseParams, 30),
        'by_vendor_principle' => groupBy($db, 'vendor_principle', $baseWhere, $baseParams, 20),
        'by_mitra_impl'       => groupBy($db, 'mitra_impl',       $baseWhere, $baseParams, 30),
        'by_issue_category'   => groupBy($db, 'issue_category',   $baseWhere, $baseParams, 20),
        'by_status_po'        => groupBy($db, 'status_po',        $baseWhere, $baseParams, 10),
        'by_tp_detail'        => groupBy($db, 'tp_detail',        $baseWhere, $baseParams, 30),
        'by_province'         => groupBy($db, 'province',         $baseWhere, $baseParams, 40),
        'by_city'             => groupBy($db, 'city',             $baseWhere, $baseParams, 50),
        'by_status_project'   => groupBy($db, 'status_project',   $baseWhere, $baseParams, 20),
        'by_rfs_month'        => groupBy($db, 'rfs_month',        $baseWhere, $baseParams, 24),
    ],
    'top_pending' => $topPending,
]);



