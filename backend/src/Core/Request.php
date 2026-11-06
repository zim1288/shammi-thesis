<?php
namespace App\Core;

/**
 * HTTP Request Parser & Input Sanitizer
 * ESP32 Home Patient Monitoring System
 */
class Request {
    private array $body = [];
    private array $query = [];
    private array $rawBody = [];
    private array $rawQuery = [];
    private array $headers = [];

    public function __construct() {
        $raw = file_get_contents('php://input');
        $json = json_decode($raw, true);

        if (is_array($json)) {
            $this->rawBody = $json;
            $this->body    = $this->sanitizeArray($json);
        } elseif (!empty($_POST)) {
            $this->rawBody = $_POST;
            $this->body    = $this->sanitizeArray($_POST);
        }

        $this->rawQuery = $_GET;
        $this->query    = $this->sanitizeArray($_GET);
        $this->headers  = function_exists('getallheaders') ? getallheaders() : [];
    }

    public function getMethod(): string {
        return $_SERVER['REQUEST_METHOD'] ?? 'GET';
    }

    public function getBody(): array {
        return $this->body;
    }

    public function getQuery(): array {
        return $this->query;
    }

    /**
     * Get sanitized parameter (HTML-escaped, trimmed)
     */
    public function get(string $key, $default = null) {
        return $this->body[$key] ?? $this->query[$key] ?? $default;
    }

    /**
     * Get raw unescaped parameter (critical for passwords, tokens, and hashes)
     */
    public function getRaw(string $key, $default = null) {
        return $this->rawBody[$key] ?? $this->rawQuery[$key] ?? $default;
    }

    public function getHeader(string $name, $default = null): ?string {
        foreach ($this->headers as $key => $val) {
            if (strcasecmp($key, $name) === 0) {
                return $val;
            }
        }
        return $default;
    }

    private function sanitizeArray(array $data): array {
        $clean = [];
        foreach ($data as $key => $val) {
            if (is_array($val)) {
                $clean[$key] = $this->sanitizeArray($val);
            } elseif (is_string($val)) {
                $clean[$key] = htmlspecialchars(trim($val), ENT_QUOTES, 'UTF-8');
            } else {
                $clean[$key] = $val;
            }
        }
        return $clean;
    }
}
