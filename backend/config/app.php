<?php
/**
 * Application Environment Configuration
 * ESP32 Home Patient Monitoring System - Educational Prototype
 */

// Timezone configuration (Change to your local timezone)
date_default_timezone_set('Asia/Dhaka');

// Error reporting for development (set to 0 in production)
ini_set('display_errors', '0');
error_reporting(E_ALL);

// ---------------------------------------------------------
// Autoloader Configuration
// ---------------------------------------------------------
// 1. Composer autoloader if installed
if (file_exists(__DIR__ . '/../../vendor/autoload.php')) {
    require_once __DIR__ . '/../../vendor/autoload.php';
}

// 2. PSR-4 Class Autoloader for App\ namespace
spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/../src/';
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }
    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';
    if (file_exists($file)) {
        require_once $file;
    }
});

// Session Security Configuration
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_samesite', 'Lax');
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        ini_set('session.cookie_secure', '1');
    }
    session_start();
}

// Mandatory Prototype Notice
define('SYSTEM_NOTICE', 'Educational Prototype — Not for Diagnosis');

// API Ingestion Bearer Token (Loaded securely from Render Environment Variables)
define('API_INGEST_KEY', getenv('API_INGEST_KEY') ?: '');

// CORS and Security Headers helper
function setGlobalCorsHeaders() {
    if (PHP_SAPI !== 'cli') {
        header("Content-Type: application/json; charset=UTF-8");
        $origin = getenv('CORS_ALLOWED_ORIGIN') ?: '*';
        header("Access-Control-Allow-Origin: " . $origin);
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token");
        header("X-Content-Type-Options: nosniff");
        header("X-Frame-Options: SAMEORIGIN");
        header("X-XSS-Protection: 1; mode=block");
        header("Referrer-Policy: strict-origin-when-cross-origin");

        if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }
}
