<?php

/**
 * Progress logic helpers.
 * Logic is configurable via the settings table (loaded once per request).
 */

$_progressSettings = null;

function getProgressSettings(): array {
    global $_progressSettings;
    if ($_progressSettings !== null) return $_progressSettings;

    try {
        $db = getDB();
        $rows = $db->query("SELECT setting_key, setting_value FROM settings")->fetchAll(PDO::FETCH_KEY_PAIR);
        $_progressSettings = $rows;
    } catch (Throwable $e) {
        $_progressSettings = [];
    }
    return $_progressSettings;
}

function getSetting(string $key, string $default = ''): string {
    $settings = getProgressSettings();
    return $settings[$key] ?? $default;
}

function isCompleted(array $row): bool {
    $settings = getProgressSettings();
    $useFlag = ($settings['completed_uses_flag'] ?? '1') === '1';
    $useRfs  = ($settings['completed_uses_rfs']  ?? '1') === '1';

    if ($useFlag && ($row['progress_done_flag'] ?? '') === '1') return true;
    if ($useRfs  && !empty($row['rfs_actual'])) return true;
    return false;
}

function isDropped(array $row): bool {
    $settings = getProgressSettings();
    $usePo  = ($settings['dropped_uses_status_po'] ?? '1') === '1';
    $useFlg = ($settings['dropped_uses_flag_x']   ?? '1') === '1';

    if ($usePo  && strcasecmp(trim($row['status_po'] ?? ''), 'drop') === 0) return true;
    if ($useFlg && ($row['progress_done_flag'] ?? '') === 'x') return true;
    return false;
}

function isRemaining(array $row): bool {
    return !isCompleted($row) && !isDropped($row);
}

function isIssue(array $row): bool {
    $settings = getProgressSettings();
    $checkPic  = ($settings['issue_check_pic_blocking']          ?? '1') === '1';
    $checkAcc  = ($settings['issue_check_acceptance_blocking']   ?? '1') === '1';
    $excCat    = $settings['issue_exclude_category'] ?? '01. RFS';

    $issueCategory = trim($row['issue_category'] ?? '');
    if ($issueCategory !== '' && strcasecmp($issueCategory, $excCat) !== 0) return true;

    if ($checkPic && !empty(trim($row['pic_blocking'] ?? ''))) return true;

    if ($checkAcc) {
        $accCols = ['atp_blocking','lv_blocking','oac_blocking','qc_blocking','sqac_blocking','baut_blocking','bast_blocking'];
        foreach ($accCols as $col) {
            if (!empty(trim($row[$col] ?? ''))) return true;
        }
    }

    return false;
}

function getProgressStatus(array $row): string {
    if (isDropped($row)) return 'Dropped';
    if (isCompleted($row)) return 'Completed';
    return 'Not Yet';
}

/**
 * Build SQL conditions + params for a progress_status filter value.
 * Returns ['conditions' => [...], 'params' => [...]]
 */
function progressStatusConditions(string $status): array {
    $conditions = [];
    $params = [];

    if ($status === 'Completed') {
        $conditions[] = "(p.progress_done_flag = '1' OR (p.rfs_actual IS NOT NULL AND p.rfs_actual != ''))";
    } elseif ($status === 'Dropped') {
        $conditions[] = "(LOWER(p.status_po) = 'drop' OR p.progress_done_flag = 'x')";
    } elseif ($status === 'Not Yet') {
        $conditions[] = "p.progress_done_flag NOT IN ('1','x')";
        $conditions[] = "(p.rfs_actual IS NULL OR p.rfs_actual = '')";
        $conditions[] = "LOWER(p.status_po) != 'drop'";
    }

    return ['conditions' => $conditions, 'params' => $params];
}
