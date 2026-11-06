<?php
/**
 * Controller: CSRF Token Issuer
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Security.php';

use App\Core\Response;
use App\Core\Security;

Response::success([
    'csrf_token' => Security::generateCsrfToken()
], 'CSRF token generated');
