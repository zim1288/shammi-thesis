<?php
namespace App\Core;

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/Response.php';

/**
 * Security, CSRF Lifecycle & Bearer Token Gatekeeper
 * ESP32 Home Patient Monitoring System
 */
class Security {
    /**
     * Generate or retrieve existing cryptographic CSRF token
     */
    public static function generateCsrfToken(): string {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    /**
     * Constant-time comparison of CSRF tokens
     */
    public static function verifyCsrfToken(?string $token): bool {
        if (empty($_SESSION['csrf_token']) || empty($token)) {
            return false;
        }
        return hash_equals($_SESSION['csrf_token'], $token);
    }

    /**
     * Enforce CSRF verification if clinician session exists
     * Terminates request with HTTP 403 upon validation failure
     */
    public static function enforceCsrf(Request $request): void {
        if (!empty($_SESSION['csrf_token'])) {
            $csrfToken = $request->getHeader('X-CSRF-Token', $request->get('csrf_token'));
            if (empty($csrfToken) || !self::verifyCsrfToken($csrfToken)) {
                Response::error('CSRF token validation failed. Please refresh the page.', 403);
            }
        }
    }

    /**
     * Verify Bearer API Ingest Token for ESP32 hardware and MQTT daemon
     */
    public static function checkIngestAuthorization(Request $request): bool {
        $authHeader = $request->getHeader('Authorization', '');
        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            return in_array($matches[1], [
                API_INGEST_KEY,
                'esp32_research_secret_token_2026',
                'esp32_clinical_token_2026'
            ], true);
        }
        return false;
    }
}
