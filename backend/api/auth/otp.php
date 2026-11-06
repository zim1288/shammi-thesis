<?php
/**
 * Controller: OTP Lifecycle & Verification Manager
 * ESP32 Home Patient Monitoring System
 *
 * Implements:
 * - 30-Minute Strict Code Expiration
 * - Immediate Invalidation of Superseded Codes on Resend
 * - 2-Minute (120s) Strict Resend Rate-Limiting (HTTP 429)
 * - 30-Minute Active Session Reuse across navigations
 * - Thread-Safe Atomic Persistence via OtpRepository (LOCK_EX)
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Core/Security.php';
require_once __DIR__ . '/../../src/Repositories/OtpRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Core\Security;
use App\Repositories\OtpRepository;

$request = new Request();
$action  = strtolower(trim($request->get('action', 'status')));
$email   = strtolower(trim($request->get('email', '')));

// Strict email format validation
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    Response::error('A complete and valid clinical email address is required.', 422);
}

$otpRepo = new OtpRepository();

// -----------------------------------------------------------------------------
// ACTION: REQUEST OR RESEND OTP
// -----------------------------------------------------------------------------
if ($action === 'request' || $action === 'resend') {
    $isResend = ($action === 'resend');
    $result = $otpRepo->requestOrResend($email, $isResend);

    if (!$result['success']) {
        if (($result['status'] ?? '') === 'rate_limited') {
            Response::error($result['error'], 429, ['wait_seconds' => $result['wait_seconds']]);
        }
        Response::error($result['error'] ?? 'Unable to process request.', 400);
    }

    $statusCode = ($result['status'] === 'newly_issued') ? 201 : 200;

    Response::success([
        'email'         => $email,
        'status'        => $result['status'],
        'expires_in'    => $result['expires_in'],
        'can_resend_in' => $result['can_resend_in'],
        'dispatch_code' => $result['code'], // For EmailJS SDK integration
        'message'       => $result['message']
    ], $result['message'], $statusCode);

// -----------------------------------------------------------------------------
// ACTION: VERIFY OTP
// -----------------------------------------------------------------------------
} elseif ($action === 'verify') {
    $enteredOtp = trim($request->get('otp', ''));

    if (empty($enteredOtp)) {
        Response::error('Please enter the 4-digit verification code.', 422);
    }

    $res = $otpRepo->verify($email, $enteredOtp);

    if (!$res['success']) {
        $extra = !empty($res['expired']) ? ['expired' => true] : [];
        Response::error($res['error'], $res['http_code'] ?? 400, $extra);
    }

    // Auto-authenticate verified user session
    session_regenerate_id(true);
    $_SESSION['user_id']   = 'USR-' . strtoupper(substr(md5($email), 0, 6));
    $_SESSION['username']  = $email;
    $_SESSION['email']     = $email;
    $_SESSION['full_name'] = trim($request->get('name', '')) ?: 'Authorized Clinician';
    $_SESSION['role']      = 'attending_physician';

    Response::success([
        'verified'   => true,
        'user'       => [
            'id'            => $_SESSION['user_id'],
            'username'      => $_SESSION['username'],
            'email'         => $_SESSION['email'],
            'full_name'     => $_SESSION['full_name'],
            'role'          => $_SESSION['role'],
            'authenticated' => true
        ],
        'csrf_token' => Security::generateCsrfToken()
    ], 'Identity verified successfully');

// -----------------------------------------------------------------------------
// ACTION: STATUS CHECK
// -----------------------------------------------------------------------------
} elseif ($action === 'status') {
    $existing = $otpRepo->findByEmail($email);
    $now = time();

    if (!$existing || ($existing['status'] ?? '') !== 'active' || $now > (int)($existing['expires_at'] ?? 0)) {
        Response::success([
            'email'         => $email,
            'has_active'    => false,
            'can_resend_in' => 0
        ]);
    }

    Response::success([
        'email'         => $email,
        'has_active'    => true,
        'expires_in'    => max(0, (int)$existing['expires_at'] - $now),
        'can_resend_in' => max(0, OtpRepository::RESEND_COOLDOWN_SECONDS - ($now - (int)$existing['last_sent_at']))
    ]);

} else {
    Response::error("Unsupported OTP action: '{$action}'", 400);
}
