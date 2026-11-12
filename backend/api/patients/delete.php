<?php
/**
 * Controller: Delete / Discharge Patient & Free IoT Device Node
 * ESP32 Home Patient Monitoring System
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Core/Security.php';
require_once __DIR__ . '/../../src/Repositories/PatientRepository.php';
require_once __DIR__ . '/../../src/Repositories/DeviceRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Core\Security;
use App\Repositories\PatientRepository;
use App\Repositories\DeviceRepository;

$request = new Request();
$method = $request->getMethod();

if ($method !== 'POST' && $method !== 'DELETE') {
    Response::error('Only POST or DELETE requests allowed', 405);
}

// CSRF Verification for state-changing browser requests
Security::enforceCsrf($request);

$patientId = trim($request->get('patient_id', $request->get('id', '')));

if (empty($patientId)) {
    Response::error('Patient ID or Code is required for deletion.', 400);
}

$patientRepo = new PatientRepository();
$deviceRepo  = new DeviceRepository();

// Look up patient to locate associated device and details
$patient = $patientRepo->findById($patientId);
if (!$patient) {
    Response::error('Patient not found or already discharged.', 404);
}

$patientName = $patient['full_name'] ?? 'Patient';
$deviceUid   = $patient['assigned_device_uid'] ?? null;

// 1. Unassign & release the wearable IoT device so it can be re-paired
if (!empty($deviceUid)) {
    $deviceRepo->unassignPatient($deviceUid);
}
$deviceRepo->unassignByPatientId($patientId);

// 2. Delete patient from repository
$deleted = $patientRepo->delete($patientId);

if (!$deleted) {
    Response::error('Failed to remove patient from data store.', 500);
}

Response::success([
    'deleted_patient_id' => $patientId,
    'freed_device_uid'   => $deviceUid
], "Patient {$patientName} (#{$patientId}) has been successfully discharged and removed.");
