<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();
$body  = getRequestBody();

// Accept single key+value or array of {key, value} pairs
$updates = [];

if (isset($body['key']) && isset($body['value'])) {
    $updates[] = ['key' => $body['key'], 'value' => $body['value']];
} elseif (isset($body['settings']) && is_array($body['settings'])) {
    foreach ($body['settings'] as $item) {
        if (isset($item['key'])) {
            $updates[] = ['key' => $item['key'], 'value' => $item['value'] ?? null];
        }
    }
}

if (empty($updates)) {
    jsonError('No settings provided.', 422);
}

$db = getDB();
$stmt = $db->prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ?");
$changed = 0;

foreach ($updates as $u) {
    $stmt->execute([
        $u['value'] !== null ? (string)$u['value'] : null,
        $u['key'],
    ]);
    $changed += $stmt->rowCount();
}

AuditLog::log($admin['id'], 'update_settings', 'settings', null,
    'Updated ' . count($updates) . ' setting(s)');

jsonSuccess(['updated' => $changed], 'Settings updated.');
