<?php
namespace App\Core;

require_once __DIR__ . '/../../config/app.php';

/**
 * Standardized JSON API Response Helper
 */
class Response {
    public static function json($data = [], int $statusCode = 200, bool $success = true, string $message = ''): void {
        setGlobalCorsHeaders();
        http_response_code($statusCode);

        echo json_encode([
            'success'   => $success,
            'ok'        => $success,
            'message'   => $message,
            'timestamp' => date('c'),
            'data'      => $data
        ], JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $statusCode = 400, $data = []): void {
        self::json($data, $statusCode, false, $message);
    }

    public static function success($data = [], string $message = '', int $statusCode = 200): void {
        self::json($data, $statusCode, true, $message);
    }
}
