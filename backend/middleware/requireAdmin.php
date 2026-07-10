<?php
require_once __DIR__ . '/requireAuth.php';

function requireAdmin(): array {
    $user = requireAuth();
    if (!in_array($user['role'], ['admin', 'super_admin'], true)) {
        jsonError('Forbidden. Admin access required.', 403);
    }
    return $user;
}
