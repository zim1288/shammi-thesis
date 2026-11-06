<?php
/**
 * Controller: Hardware Device Status & Heartbeat (MQTT LWT Handler)
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Core/Security.php';
require_once __DIR__ . '/../../src/Repositories/DeviceRepository.php';
require_once __DIR__ . '/../../src/Repositories/AlertRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Core\Security;
use App\Repositories\DeviceRepository;
use App\Repositories\AlertRepository;

$request = new Request();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method Not Allowed. POST required.', 405);
}

// Ingestion Token Check
if (!Security::checkIngestAuthorization($request)) {
    Response::error('Unauthorized.', 401);
}

$deviceUid = $request->get('device_uid', 'ESP32-NODE-01');
$status    = $request->get('status', 'online');

$deviceRepo = new DeviceRepository();
$deviceRepo->updateStatus($deviceUid, $status);

// If device went offline, record warning alert
if ($status === 'offline') {
    $alertRepo = new AlertRepository();
    $alertRepo->insertAlert([
        'patient_id' => $request->get('patient_id', 'PT-8802'),
        'device_uid' => $deviceUid,
        'alert_type' => 'device_offline',
        'severity'   => 'warning',
        'message'    => 'ESP32 Device Connection Lost (MQTT LWT Triggered)',
        'threshold'  => 'online',
        'actual'     => 'offline'
    ]);
}

Response::success([
    'device_uid' => $deviceUid,
    'status'     => $status
], "Device status set to {$status}");
