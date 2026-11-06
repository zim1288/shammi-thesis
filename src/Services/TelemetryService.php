<?php
namespace App\Services;

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../Repositories/PatientRepository.php';
require_once __DIR__ . '/../Repositories/DeviceRepository.php';
require_once __DIR__ . '/../Repositories/VitalsRepository.php';
require_once __DIR__ . '/../Repositories/BloodPressureRepository.php';
require_once __DIR__ . '/../Repositories/AlertRepository.php';

use App\Repositories\PatientRepository;
use App\Repositories\DeviceRepository;
use App\Repositories\VitalsRepository;
use App\Repositories\BloodPressureRepository;
use App\Repositories\AlertRepository;

/**
 * Telemetry Aggregator for Dashboard Views
 */
class TelemetryService {
    private PatientRepository $patientRepo;
    private DeviceRepository $deviceRepo;
    private VitalsRepository $vitalsRepo;
    private BloodPressureRepository $bpRepo;
    private AlertRepository $alertRepo;

    public function __construct() {
        $this->patientRepo = new PatientRepository();
        $this->deviceRepo  = new DeviceRepository();
        $this->vitalsRepo  = new VitalsRepository();
        $this->bpRepo      = new BloodPressureRepository();
        $this->alertRepo   = new AlertRepository();
    }

    public function getDashboardTelemetry(string $patientId): array {
        // 1. Patient Profile
        $patient = $this->patientRepo->findById($patientId) ?: [
            'id'           => $patientId,
            'patient_code' => $patientId,
            'full_name'    => 'Robert Vance',
            'room_bed'     => 'Bed 04 / Room 402',
            'age'          => 58,
            'gender'       => 'Male'
        ];

        // 2. Hardware Device State
        $assignedDeviceUid = $patient['assigned_device_uid'] ?? 'ESP32-NODE-01';
        $device = $this->deviceRepo->findByUid($assignedDeviceUid) ?: [
            'device_uid'     => $assignedDeviceUid,
            'status'         => 'online',
            'battery_level'  => 92,
            'wifi_rssi'      => -64,
            'last_heartbeat' => date('c')
        ];

        // Heartbeat timeout check (offline if no message in last 35 seconds)
        if (!empty($device['last_heartbeat'])) {
            $lastTime = strtotime($device['last_heartbeat']);
            if ((time() - $lastTime) > 35) {
                $device['status'] = 'offline';
            }
        }

        // 3. Latest Automatic Sensor Vitals
        $latestVitals = $this->vitalsRepo->getLatestByPatient($patientId);

        // 4. Latest Manual BP Record (Strictly Separated)
        $latestManualBp = $this->bpRepo->getLatest($patientId);

        // 5. Active Alerts Count
        $activeAlerts = $this->alertRepo->countActive($patientId);

        return [
            'prototype_notice'    => \SYSTEM_NOTICE,
            'patient'             => $patient,
            'device'              => $device,
            'latest_vitals'       => $latestVitals,
            'latest_manual_bp'    => $latestManualBp,
            'active_alerts_count' => $activeAlerts,
            'server_time'         => date('c')
        ];
    }
}
