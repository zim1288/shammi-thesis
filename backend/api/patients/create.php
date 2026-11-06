<?php
/**
 * Controller: Add New Patient & Associate IoT Device (Discharge Onboarding)
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

if ($request->getMethod() !== 'POST') {
    Response::error('Only POST requests allowed', 405);
}

// CSRF Verification for state-changing browser requests
Security::enforceCsrf($request);

$fullName = trim($request->get('full_name', ''));
$age      = (int)$request->get('age', 0);
$gender   = trim($request->get('gender', 'Male'));
$phone    = trim($request->get('phone', ''));
$ward     = trim($request->get('ward_origin', 'ICU Step-Down'));
$deviceUid= trim($request->get('device_uid', ''));
$deviceMac= trim($request->get('device_mac', ''));
$notes    = trim($request->get('medical_notes', ''));

// Baseline Thresholds
$hrMin   = (int)$request->get('hr_min', 55);
$hrMax   = (int)$request->get('hr_max', 105);
$spo2Min = (int)$request->get('spo2_min', 94);

if (empty($fullName)) {
    Response::error('Patient full name is required', 400);
}

if (empty($deviceUid)) {
    Response::error('Assigned IoT Device UID is required', 400);
}

$patientRepo = new PatientRepository();
$deviceRepo  = new DeviceRepository();

// Generate unique Patient Code (e.g. PT-6241)
$patientCode = 'PT-' . rand(1000, 9999);

$patientData = [
    'id'                  => $patientCode,
    'patient_code'        => $patientCode,
    'full_name'           => $fullName,
    'age'                 => $age,
    'gender'              => $gender,
    'phone'               => $phone,
    'ward_origin'         => $ward,
    'room_bed'            => 'Discharged Home',
    'assigned_device_uid' => $deviceUid,
    'device_mac'          => $deviceMac ?: '24:6F:28:' . strtoupper(substr(md5($deviceUid), 0, 6)),
    'risk_status'         => 'Normal',
    'discharge_date'      => date('Y-m-d'),
    'medical_notes'       => $notes ?: 'Discharged for remote observational care to optimize hospital bed turnover.',
    'baseline_thresholds' => [
        'hr_min'   => $hrMin,
        'hr_max'   => $hrMax,
        'spo2_min' => $spo2Min
    ],
    'created_at'          => date('c')
];

$patientRepo->create($patientData);

// Associate / Create Device record
$existingDevice = $deviceRepo->findByUid($deviceUid);
if ($existingDevice) {
    $deviceRepo->assignToPatient($deviceUid, $patientCode);
} else {
    $deviceRepo->create([
        'device_uid'          => $deviceUid,
        'device_name'         => "Wearable Node ($deviceUid)",
        'assigned_patient_id' => $patientCode,
        'mac_address'         => $patientData['device_mac'],
        'status'              => 'online',
        'battery_level'       => 100,
        'wifi_rssi'           => -60,
        'firmware_version'    => '1.2.0',
        'last_heartbeat'      => date('c'),
        'created_at'          => date('c')
    ]);
}

Response::success([
    'patient'    => $patientData,
    'device_uid' => $deviceUid
], 'Patient onboarded and IoT device paired successfully', 201);
