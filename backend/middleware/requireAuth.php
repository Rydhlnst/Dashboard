<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';

function requireAuth(): array {
    // Support both cookie session and Bearer token
    $userId = null;

    // Try session first
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'secure'   => isset($_SERVER['HTTPS']),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    if (!empty($_SESSION['user_id'])) {
        $userId = (int)$_SESSION['user_id'];
    }

    // Try Bearer token fallback
    if (!$userId) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/Bearer\s+(.+)/i', $auth, $m)) {
            $token = $m[1];
            $db    = getDB();
            $stmt  = $db->prepare('SELECT id FROM users WHERE status = ? AND role IN (?,?) LIMIT 1');
            // Token auth not implemented in MVP — use session only
        }
    }

    if (!$userId) {
        jsonError('Unauthorized. Please login.', 401);
    }

    $db   = getDB();
    $stmt = $db->prepare('SELECT id, name, email, role, status FROM users WHERE id = ? AND status = ? LIMIT 1');
    $stmt->execute([$userId, 'active']);
    $user = $stmt->fetch();

    if (!$user) {
        // Clear invalid session
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
        jsonError('Unauthorized. User not found or inactive.', 401);
    }

    return $user;
}
