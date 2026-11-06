<?php
namespace App\Services;

require_once __DIR__ . '/../Repositories/DeviceRepository.php';
require_once __DIR__ . '/../Repositories/VitalsRepository.php';
require_once __DIR__ . '/../Repositories/EcgBatchRepository.php';
require_once __DIR__ . '/AlertEngineService.php';

use App\Repositories\DeviceRepository;
use App\Repositories\VitalsRepository;
use App\Repositories\EcgBatchRepository;

/**
 * High-Level Telemetry & Waveform Ingestion Orchestrator
 */
class IngestionService {
    private DeviceRepository $deviceRepo;
    private VitalsRepository $vitalsRepo;
    private EcgBatchRepository $ecgBatchRepo;
    private AlertEngineService $alertEngine;

    public function __construct() {
        $this->deviceRepo   = new DeviceRepository();
        $this->vitalsRepo   = new VitalsRepository();
        $this->ecgBatchRepo = new EcgBatchRepository();
        $this->alertEngine  = new AlertEngineService();
    }

    public function processVitals(array $payload): array {
        $deviceUid = $payload['device_uid'] ?? 'ESP32-NODE-01';
        $patientId = $payload['patient_id'] ?? 'PT-8802';

        // 1. Update device online status & telemetry
        $this->deviceRepo->updateTelemetry($deviceUid, [
            'battery_level' => $payload['battery_level'] ?? null,
            'wifi_rssi'     => $payload['wifi_rssi'] ?? null,
            'ip_address'    => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);

        // 2. Format sensor telemetry document
        $readingDoc = [
            'patient_id'          => $patientId,
            'device_uid'          => $deviceUid,
            'ecg_heart_rate'      => isset($payload['ecg_heart_rate']) ? (int)$payload['ecg_heart_rate'] : null,
            'max30102_pulse_rate' => isset($payload['max30102_pulse_rate']) ? (int)$payload['max30102_pulse_rate'] : null,
            'spo2'                => isset($payload['spo2']) ? (float)$payload['spo2'] : null,
            'ir_temperature'      => isset($payload['ir_temperature']) ? (float)$payload['ir_temperature'] : null,
            'ecg_lead_status'     => $payload['ecg_lead_status'] ?? 'normal',
            'ppg_finger_detected' => isset($payload['ppg_finger_detected']) ? (int)$payload['ppg_finger_detected'] : 1,
            'signal_validity'     => (($payload['ecg_lead_status'] ?? 'normal') === 'normal' && ($payload['ppg_finger_detected'] ?? 1) == 1) ? 'valid' : 'degraded',
            'battery_level'       => $payload['battery_level'] ?? null,
            'wifi_rssi'           => $payload['wifi_rssi'] ?? null,
            'timestamp'           => $payload['timestamp'] ?? date('c'),
            'created_at'          => date('c')
        ];

        // 3. Persist document to MongoDB
        $readingId = $this->vitalsRepo->insertReading($readingDoc);

        // 4. Run automated alert evaluations
        $alertCount = $this->alertEngine->evaluateAndLog($patientId, $deviceUid, $readingDoc);

        return [
            'reading_id'     => $readingId,
            'patient_id'     => $patientId,
            'device_status'  => 'online',
            'alerts_checked' => $alertCount
        ];
    }

    public function processEcgBatch(array $payload): array {
        $deviceUid = $payload['device_uid'] ?? 'ESP32-NODE-01';
        $patientId = $payload['patient_id'] ?? 'PT-8802';
        $samples   = $payload['samples'] ?? [];

        $batchDoc = [
            'patient_id'     => $patientId,
            'device_uid'     => $deviceUid,
            'sample_rate_hz' => (int)($payload['sample_rate_hz'] ?? 125),
            'lead_name'      => $payload['lead_name'] ?? 'Lead-II',
            'sample_count'   => count($samples),
            'samples'        => array_map('floatval', $samples),
            'start_time'     => $payload['start_time'] ?? date('c'),
            'end_time'       => $payload['end_time'] ?? date('c'),
            'created_at'     => date('c')
        ];

        $batchId = $this->ecgBatchRepo->insertBatch($batchDoc);

        return [
            'batch_id'     => $batchId,
            'sample_count' => count($samples),
            'rate_hz'      => $batchDoc['sample_rate_hz']
        ];
    }
}
