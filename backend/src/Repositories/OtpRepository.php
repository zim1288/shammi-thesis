<?php
namespace App\Repositories;

/**
 * Repository: OTP Lifecycle, Rate Limiting & Verification Store
 * ESP32 Home Patient Monitoring System
 *
 * Implements:
 * - 30-Minute strict expiration lifecycle
 * - Automatic superseding / invalidation of previous OTPs
 * - 2-Minute (120s) rate-limiting calculation
 * - Thread-safe atomic updates with LOCK_EX
 */
class OtpRepository {
    private string $filePath;
    public const VALIDITY_WINDOW_SECONDS = 1800; // 30 minutes
    public const RESEND_COOLDOWN_SECONDS = 120;  // 2 minutes

    public function __construct() {
        $this->filePath = __DIR__ . '/../../data_store/active_otps.json';
        if (!file_exists($this->filePath)) {
            $this->saveStore([]);
        }
    }

    /**
     * Retrieve all active OTP sessions
     */
    public function getStore(): array {
        if (!file_exists($this->filePath)) {
            return [];
        }
        $content = file_get_contents($this->filePath);
        $data = json_decode($content, true);
        return is_array($data) ? $data : [];
    }

    /**
     * Persist OTP sessions with exclusive lock (LOCK_EX)
     */
    public function saveStore(array $store): bool {
        return file_put_contents(
            $this->filePath,
            json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
            LOCK_EX
        ) !== false;
    }

    /**
     * Find existing OTP entry by email
     */
    public function findByEmail(string $email): ?array {
        $cleanEmail = strtolower(trim($email));
        $store = $this->getStore();
        foreach ($store as $entry) {
            if (strcasecmp($entry['email'], $cleanEmail) === 0) {
                return $entry;
            }
        }
        return null;
    }

    /**
     * Request or Resend OTP
     * 
     * @return array [success => bool, status => string, error => ?string, code => ?string, wait_seconds => int, expires_in => int]
     */
    public function requestOrResend(string $email, bool $isExplicitResend = false): array {
        $cleanEmail = strtolower(trim($email));
        $store = $this->getStore();
        $now = time();

        $existing = null;
        $existingIndex = -1;

        foreach ($store as $idx => $entry) {
            if (strcasecmp($entry['email'], $cleanEmail) === 0) {
                $existing = $entry;
                $existingIndex = $idx;
                break;
            }
        }

        // 1. Rate-Limit Check: 2-minute cooldown between dispatches
        if ($existing && !empty($existing['last_sent_at'])) {
            $elapsed = $now - (int)$existing['last_sent_at'];
            if ($elapsed < self::RESEND_COOLDOWN_SECONDS && $isExplicitResend) {
                $waitRemaining = self::RESEND_COOLDOWN_SECONDS - $elapsed;
                return [
                    'success'      => false,
                    'status'       => 'rate_limited',
                    'error'        => "Rate limit active. Please wait {$waitRemaining} seconds before requesting a new code.",
                    'wait_seconds' => $waitRemaining
                ];
            }
        }

        // 2. 30-Minute Reuse Check (for initial request navigation):
        // If an OTP exists, has not expired, and is not an explicit resend, reuse active session
        if (!$isExplicitResend && $existing && !empty($existing['expires_at']) && $now < (int)$existing['expires_at'] && ($existing['status'] ?? '') === 'active') {
            $remainingValidity = (int)$existing['expires_at'] - $now;
            $cooldownRemaining = max(0, self::RESEND_COOLDOWN_SECONDS - ($now - (int)$existing['last_sent_at']));

            return [
                'success'       => true,
                'status'        => 'active_reused',
                'expires_in'    => $remainingValidity,
                'can_resend_in' => $cooldownRemaining,
                'code'          => $existing['code'],
                'message'       => 'Existing 30-minute verification code is active'
            ];
        }

        // 3. Generate fresh 4-digit code and mark 30-minute window
        $newCode = str_pad((string)random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
        $otpRecord = [
            'email'        => $cleanEmail,
            'code'         => $newCode,
            'created_at'   => $now,
            'last_sent_at' => $now,
            'expires_at'   => $now + self::VALIDITY_WINDOW_SECONDS,
            'status'       => 'active'
        ];

        if ($existingIndex >= 0) {
            $store[$existingIndex] = $otpRecord;
        } else {
            $store[] = $otpRecord;
        }

        $this->saveStore($store);

        return [
            'success'       => true,
            'status'        => 'newly_issued',
            'expires_in'    => self::VALIDITY_WINDOW_SECONDS,
            'can_resend_in' => self::RESEND_COOLDOWN_SECONDS,
            'code'          => $newCode,
            'message'       => 'Verification code dispatched successfully'
        ];
    }

    /**
     * Verify an entered OTP
     * 
     * @return array [success => bool, error => ?string, http_code => int]
     */
    public function verify(string $email, string $enteredCode): array {
        $cleanEmail = strtolower(trim($email));
        $cleanCode = trim($enteredCode);
        $store = $this->getStore();
        $now = time();

        $matched = null;
        $matchedIndex = -1;

        foreach ($store as $idx => $entry) {
            if (strcasecmp($entry['email'], $cleanEmail) === 0) {
                $matched = $entry;
                $matchedIndex = $idx;
                break;
            }
        }

        if (!$matched) {
            return [
                'success'   => false,
                'error'     => 'No active verification session found. Please request a verification code.',
                'http_code' => 404
            ];
        }

        if (($matched['status'] ?? '') === 'superseded') {
            return [
                'success'   => false,
                'error'     => 'This verification code has been superseded by a newly requested code. Please enter the latest code.',
                'http_code' => 400
            ];
        }

        if (($matched['status'] ?? '') === 'used') {
            return [
                'success'   => false,
                'error'     => 'This verification code has already been used. Please request a new code.',
                'http_code' => 400
            ];
        }

        if ($now > (int)$matched['expires_at']) {
            $store[$matchedIndex]['status'] = 'expired';
            $this->saveStore($store);
            return [
                'success'   => false,
                'error'     => 'The verification code has expired (30-minute validity limit). Please request a new code.',
                'http_code' => 410,
                'expired'   => true
            ];
        }

        if ($matched['code'] !== $cleanCode) {
            return [
                'success'   => false,
                'error'     => 'Incorrect verification code. Please check your email and try again.',
                'http_code' => 400
            ];
        }

        // Success: Mark used
        $store[$matchedIndex]['status'] = 'used';
        $store[$matchedIndex]['verified_at'] = $now;
        $this->saveStore($store);

        return [
            'success'   => true,
            'http_code' => 200
        ];
    }
}
