<?php
function applyReportDateFilter(array &$conditions, array &$params, string $alias = 'p'): void
{
    $dateFrom = trim($_GET['date_from'] ?? '');
    $dateTo = trim($_GET['date_to'] ?? '');
    $prefix = $alias !== '' ? "{$alias}." : '';
    $dateExpr = "DATE(COALESCE({$prefix}rfs_actual, {$prefix}updated_at))";

    if ($dateFrom !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
        $conditions[] = "{$dateExpr} >= ?";
        $params[] = $dateFrom;
    }

    if ($dateTo !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
        $conditions[] = "{$dateExpr} <= ?";
        $params[] = $dateTo;
    }
}
