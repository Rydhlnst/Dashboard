<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/requireAdmin.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/validation.php';
require_once __DIR__ . '/../../models/AuditLog.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonError('Method not allowed.', 405);
}

$admin = requireAdmin();

$id = sanitizeInt($_GET['id'] ?? null);
if (!$id) {
    jsonError('Invalid or missing project ID.', 400);
}

$db   = getDB();
$stmt = $db->prepare('SELECT id FROM project_records WHERE id = ? AND deleted_at IS NULL LIMIT 1');
$stmt->execute([$id]);
if (!$stmt->fetch()) {
    jsonError('Project not found.', 404);
}

// Soft delete
$stmt = $db->prepare('UPDATE project_records SET deleted_at = NOW(), updated_by = ? WHERE id = ?');
$stmt->execute([$admin['id'], $id]);

AuditLog::log($admin['id'], 'delete', 'project_record', (string)$id, "Soft-deleted project record ID {$id}");

jsonSuccess(null, 'Project deleted successfully.');
