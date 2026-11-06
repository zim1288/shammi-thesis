<?php
/**
 * Local Development Server Router
 * ESP32 Home Patient Monitoring System
 *
 * Usage:
 *   php -S localhost:8000 router.php
 *
 * Enforces:
 * - Strict 403 Forbidden protection on /backend/data_store/ and sensitive files (.json, .env, .log, .md)
 * - Clean REST API routing for /api/v1/* (with or without .php)
 * - Backward-compatible mapping of /api/* -> backend/api/*
 * - Backward-compatible mapping of /public/* -> frontend/*
 * - Safe routing for PHP APIs and public frontend static assets
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// 1. HARD SECURITY BLOCK: Deny any direct HTTP access to data_store or sensitive files
if (
    preg_match('#^/(backend/)?data_store(/.*)?$#i', $uri) ||
    preg_match('#^/backend/(src|config|database)(/.*)?$#i', $uri) ||
    preg_match('#\.(json|env|log|sql|md|yaml|yml|bak|swp)$#i', $uri) ||
    preg_match('#(^|/)\.#', $uri) // hidden files (.git, .env)
) {
    http_response_code(403);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'success'   => false,
        'ok'        => false,
        'error'     => 'Access Denied: Direct browser access to internal data stores, source code, and configuration is strictly forbidden.',
        'timestamp' => date('c')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// 2. Specific REST v1 Clean Route Mappings
$v1Routes = [
    '/api/v1/readings'        => __DIR__ . '/backend/api/v1/readings.php',
    '/api/v1/ecg'             => __DIR__ . '/backend/api/v1/ecg.php',
    '/api/v1/blood-pressure'  => __DIR__ . '/backend/api/v1/blood_pressure.php',
    '/api/v1/latest'          => __DIR__ . '/backend/api/v1/latest.php',
    '/api/v1/history'         => __DIR__ . '/backend/api/v1/history.php',
    '/api/v1/alerts'          => __DIR__ . '/backend/api/v1/alerts.php',
    '/api/v1/device/status'   => __DIR__ . '/backend/api/v1/device_status.php'
];

$normalizedUri = rtrim($uri, '/');
if (isset($v1Routes[$normalizedUri])) {
    require $v1Routes[$normalizedUri];
    exit;
}

// 3. Map general /api/* requests to backend/api/* (supports with or without .php)
if (preg_match('#^/api/(.*)$#', $uri, $matches)) {
    $subPath = $matches[1];
    $apiFile = __DIR__ . '/backend/api/' . $subPath;

    if (file_exists($apiFile) && pathinfo($apiFile, PATHINFO_EXTENSION) === 'php') {
        require $apiFile;
        exit;
    }
    if (file_exists($apiFile . '.php')) {
        require $apiFile . '.php';
        exit;
    }
}

// 4. Map legacy /public/* requests to frontend/* for zero disruption
if (preg_match('#^/public/(.*)$#', $uri, $matches)) {
    $target = '/frontend/' . $matches[1];
    header("Location: {$target}", true, 301);
    exit;
}

// 5. Direct existing static file or PHP script
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

// 6. Fallback to index.php
require __DIR__ . '/index.php';
