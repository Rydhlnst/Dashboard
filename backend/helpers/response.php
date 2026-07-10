<?php

// Flag JSON standar: Unicode tidak di-escape (penting untuk teks Indonesia), slashes tidak di-escape
// JSON_HEX_TAG tidak diperlukan karena frontend React escape output-nya sendiri
const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR;

function jsonSuccess($data = null, string $message = 'Success', int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    try {
        echo json_encode([
            'success' => true,
            'message' => $message,
            'data'    => $data,
        ], JSON_FLAGS);
    } catch (JsonException $e) {
        // Fallback jika ada karakter yang tidak bisa di-encode
        echo json_encode(['success' => true, 'message' => $message, 'data' => null]);
    }
    exit;
}

function jsonError(string $message = 'Error', int $code = 400, $errors = null): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    $body = ['success' => false, 'message' => $message];
    if ($errors !== null) {
        $body['errors'] = $errors;
    }
    try {
        echo json_encode($body, JSON_FLAGS);
    } catch (JsonException $e) {
        echo json_encode(['success' => false, 'message' => 'Error']);
    }
    exit;
}

function jsonPaginated(array $items, int $total, int $page, int $limit, string $message = 'Success'): void {
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    try {
        echo json_encode([
            'success' => true,
            'message' => $message,
            'data'    => $items,
            'meta'    => [
                'total'       => $total,
                'page'        => $page,
                'limit'       => $limit,
                'total_pages' => $limit > 0 ? (int) ceil($total / $limit) : 1,
            ],
        ], JSON_FLAGS);
    } catch (JsonException $e) {
        echo json_encode(['success' => false, 'message' => 'JSON encode error: ' . $e->getMessage()]);
    }
    exit;
}

function getRequestBody(): array {
    $body = file_get_contents('php://input');
    if (empty($body)) return [];
    try {
        $data = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        return is_array($data) ? $data : [];
    } catch (JsonException $e) {
        return [];
    }
}

function getClientIp(): string {
    foreach (['HTTP_X_FORWARDED_FOR', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) {
            $ip = trim(explode(',', $_SERVER[$key])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function getUserAgent(): string {
    return substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500);
}
