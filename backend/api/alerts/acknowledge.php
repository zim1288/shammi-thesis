<?php
/**
 * Controller: Acknowledge Alert
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Core/Security.php';
require_once __DIR__ . '/../../src/Repositories/AlertRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Core\Security;
use App\Repositories\AlertRepository;

$request = new Request();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method Not Allowed. POST required.', 405);
}

// CSRF Verification
Security::enforceCsrf($request);

$alertId = $request->get('alert_id');

if (empty($alertId)) {
    Response::error('alert_id is required.', 422);
}

$alertRepo = new AlertRepository();
$alertRepo->acknowledge($alertId, $_SESSION['full_name'] ?? 'Staff User');

Response::success([
    'alert_id'        => $alertId,
    'is_acknowledged' => true
], 'Alert acknowledged');
