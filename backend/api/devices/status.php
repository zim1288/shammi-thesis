<?php
/**
 * Controller: Hardware Device Status & Heartbeat Manager
 * Supports:
 * - GET: Retrieve device online/offline telemetry, battery, and signal
 * - POST: Update heartbeat & status (MQTT LWT or periodic keepalive)
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
$method  = $request->getMethod();
$deviceRepo = new DeviceRepository();

// -----------------------------------------------------------------------------
// GET: Query Device Status
// -----------------------------------------------------------------------------
if ($method === 'GET') {
    $deviceUid = $request->get('device_uid', 'ESP32-NODE-01');
    $device = $deviceRepo->findByUid($deviceUid);

    if (!$device) {
        Response::error("Device '{$deviceUid}' not registered in telemetry network.", 404);
    }

    // Evaluate dynamic heartbeat state (offline if inactive > 35s)
    $lastHeartbeat = !empty($device['last_heartbeat']) ? strtotime($device['last_heartbeat']) : 0;
    $isStale = (time() - $lastHeartbeat) > 35;
    $computedStatus = $isStale ? 'offline' : ($device['status'] ?? 'online');

    Response::success([
        'device_uid'          => $device['device_uid'],
        'device_name'         => $device['device_name'] ?? "Wearable Node ({$device['device_uid']})",
        'assigned_patient_id' => $device['assigned_patient_id'] ?? null,
        'status'              => $computedStatus,
        'battery_level'       => $device['battery_level'] ?? 100,
        'wifi_rssi'           => $device['wifi_rssi'] ?? -60,
        'firmware_version'    => $device['firmware_version'] ?? '1.2.0',
        'last_heartbeat'      => $device['last_heartbeat'] ?? null,
        'heartbeat_age_sec'   => time() - $lastHeartbeat
    ], 'Device status retrieved successfully');
}

// -----------------------------------------------------------------------------
// POST: Hardware Status Heartbeat Update
// -----------------------------------------------------------------------------
if ($method === 'POST') {
    // Ingestion Token Check for hardware
    if (!Security::checkIngestAuthorization($request)) {
        Response::error('Unauthorized. Valid Bearer API Key required.', 401);
    }

    $deviceUid = $request->get('device_uid', 'ESP32-NODE-01');
    $status    = $request->get('status', 'online');

    $deviceRepo->updateStatus($deviceUid, $status);

    // If device went offline, trigger warning alarm
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
        'status'     => $status,
        'timestamp'  => date('c')
    ], "Device status set to {$status}");
}

Response::error('Method Not Allowed', 405);
