<?php
/**
 * Controller: List Active Monitored Patients (Central Doctor Dashboard)
 * ESP32 Home Patient Monitoring System
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Repositories/PatientRepository.php';
require_once __DIR__ . '/../../src/Repositories/DeviceRepository.php';
require_once __DIR__ . '/../../src/Repositories/VitalsRepository.php';
require_once __DIR__ . '/../../src/Repositories/AlertRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Repositories\PatientRepository;
use App\Repositories\DeviceRepository;
use App\Repositories\VitalsRepository;
use App\Repositories\AlertRepository;

$patientRepo = new PatientRepository();
$deviceRepo  = new DeviceRepository();
$vitalsRepo  = new VitalsRepository();
$alertRepo   = new AlertRepository();

$request = new Request();
$filterRisk = $request->get('risk', null);
$filterWard = $request->get('ward', null);
$searchQuery = strtolower(trim($request->get('q', '')));

$allPatients = $patientRepo->getAll([], ['sort' => ['created_at' => -1]]);

$roster = [];
$stats = [
    'total_monitored'   => count($allPatients),
    'beds_decongested'  => count($allPatients),
    'normal_count'      => 0,
    'caution_count'     => 0,
    'critical_count'    => 0,
    'devices_online'    => 0
];

foreach ($allPatients as $p) {
    $patientId = $p['id'] ?? $p['patient_code'];
    
    // Assigned hardware device lookup
    $deviceUid = $p['assigned_device_uid'] ?? 'ESP32-NODE-01';
    $device = $deviceRepo->findByUid($deviceUid) ?: [
        'device_uid'    => $deviceUid,
        'status'        => 'offline',
        'battery_level' => 0,
        'wifi_rssi'     => -99
    ];

    if (($device['status'] ?? 'offline') === 'online') {
        $stats['devices_online']++;
    }

    // Latest vitals snapshot
    $latestVitals = $vitalsRepo->getLatestByPatient($patientId) ?: [
        'ecg_heart_rate'      => null,
        'max30102_pulse_rate' => null,
        'spo2'                => null,
        'ir_temperature'      => null,
        'timestamp'           => null
    ];

    // Determine physiological risk tier
    $risk = $p['risk_status'] ?? 'Normal';
    $hr = $latestVitals['ecg_heart_rate'] ?? 72;
    $spo2 = $latestVitals['spo2'] ?? 98;

    if ($spo2 !== null && $spo2 < 93 || ($hr !== null && ($hr > 115 || $hr < 48))) {
        $risk = 'Critical';
    } elseif ($spo2 !== null && $spo2 < 95 || ($hr !== null && ($hr > 100 || $hr < 55))) {
        $risk = ($risk === 'Critical') ? 'Critical' : 'Caution';
    }

    if ($risk === 'Critical') $stats['critical_count']++;
    elseif ($risk === 'Caution') $stats['caution_count']++;
    else $stats['normal_count']++;

    $patientRow = [
        'id'                  => $patientId,
        'patient_code'        => $p['patient_code'] ?? $patientId,
        'full_name'           => $p['full_name'] ?? 'Anonymous Patient',
        'age'                 => $p['age'] ?? 0,
        'gender'              => $p['gender'] ?? 'N/A',
        'phone'               => $p['phone'] ?? 'N/A',
        'ward_origin'         => $p['ward_origin'] ?? 'Step-Down Recovery',
        'room_bed'            => $p['room_bed'] ?? 'Discharged Home',
        'discharge_date'      => $p['discharge_date'] ?? date('Y-m-d'),
        'medical_notes'       => $p['medical_notes'] ?? '',
        'assigned_device'     => [
            'device_uid'      => $deviceUid,
            'device_mac'      => $p['device_mac'] ?? ($device['mac_address'] ?? 'N/A'),
            'status'          => $device['status'] ?? 'offline',
            'battery_level'   => $device['battery_level'] ?? 0,
            'wifi_rssi'       => $device['wifi_rssi'] ?? -99
        ],
        'latest_vitals'       => $latestVitals,
        'risk_status'         => $risk,
        'active_alerts'       => $alertRepo->countActive($patientId)
    ];

    // Filter checks
    if ($filterRisk && strtolower($risk) !== strtolower($filterRisk)) {
        continue;
    }
    if ($filterWard && stripos($patientRow['ward_origin'], $filterWard) === false) {
        continue;
    }
    if ($searchQuery !== '') {
        $haystack = strtolower($patientRow['full_name'] . ' ' . $patientRow['patient_code'] . ' ' . $deviceUid . ' ' . $patientRow['ward_origin']);
        if (strpos($haystack, $searchQuery) === false) {
            continue;
        }
    }

    $roster[] = $patientRow;
}

Response::success([
    'stats'    => $stats,
    'patients' => $roster
], 'Active patient roster retrieved');
