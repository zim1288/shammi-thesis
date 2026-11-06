<?php
/**
 * Local Development Server Router
 * ESP32 Home Patient Monitoring System
 *
 * Usage:
 *   php -S localhost:8000 router.php
 *
 * Enforces:
 * - Strict 403 Forbidden protection on /data_store/ and sensitive files (.json, .env, .log, .md)
 * - Safe routing for PHP APIs and public frontend static assets
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// 1. HARD SECURITY BLOCK: Deny any direct HTTP access to data_store or sensitive files
if (
    preg_match('#^/data_store(/.*)?$#i', $uri) ||
    preg_match('#\.(json|env|log|sql|md|yaml|yml|bak|swp)$#i', $uri) ||
    preg_match('#(^|/)\.#', $uri) // hidden files (.git, .env)
) {
    http_response_code(403);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'success'   => false,
        'ok'        => false,
        'error'     => 'Access Denied: Direct browser access to internal data stores and configuration is strictly forbidden.',
        'timestamp' => date('c')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// 2. Direct existing static file or PHP script
$filePath = __DIR__ . $uri;

if ($uri !== '/' && file_exists($filePath)) {
    // If it's a directory with an index.php or index.html
    if (is_dir($filePath)) {
        if (file_exists($filePath . '/index.php')) {
            require $filePath . '/index.php';
            exit;
        } elseif (file_exists($filePath . '/index.html')) {
            return false; // let built-in server serve it
        }
    }
    // If it's a PHP file, execute it
    if (pathinfo($filePath, PATHINFO_EXTENSION) === 'php') {
        require $filePath;
        exit;
    }
    // Static asset (css, js, images) -> let built-in server serve
    return false;
}

// 3. Fallback to index.php
require __DIR__ . '/index.php';
