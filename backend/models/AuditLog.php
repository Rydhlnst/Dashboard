<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';

class AuditLog {
    public static function log(
        ?int   $userId,
        string $action,
        string $entity    = '',
        string $entityId  = '',
        string $description = ''
    ): void {
        try {
            $db   = getDB();
            $stmt = $db->prepare(
                'INSERT INTO audit_logs (user_id, action, entity, entity_id, description, ip_address, user_agent, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())'
            );
            $stmt->execute([
                $userId,
                $action,
                $entity,
                $entityId,
                $description,
                getClientIp(),
                getUserAgent(),
            ]);
        } catch (Throwable $e) {
            // Audit log failure must not crash the request
            error_log('AuditLog::log error: ' . $e->getMessage());
        }
    }
}
