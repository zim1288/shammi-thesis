<?php
/**
 * Root Entrypoint & Production Traffic Router
 * ESP32 Home Patient Monitoring System
 *
 * Enforces authentication-first:
 * - Unauthenticated visitors -> Redirected to Login / Registration (public/auth.html)
 * - Authenticated clinicians -> Redirected to Central Doctor Dashboard (public/patients.html)
 */
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    session_start();
}

if (!empty($_SESSION['user_id'])) {
    header('Location: public/patients.html');
    exit;
}

header('Location: public/auth.html');
exit;
