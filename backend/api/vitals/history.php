<?php
/**
 * Controller: Historical Biosignals & Dataset CSV Export
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Repositories/VitalsRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Repositories\VitalsRepository;

$request = new Request();
$patientId = $request->get('patient_id', 'PT-8802');
$limit     = min((int)$request->get('limit', 50), 1000);
$format    = strtolower($request->get('format', 'json'));

$vitalsRepo = new VitalsRepository();
$history = $vitalsRepo->getHistory($patientId, $limit);

// CSV Export for Research Dataset
if ($format === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=patient_' . $patientId . '_dataset_' . date('Ymd_His') . '.csv');
    
    $out = fopen('php://output', 'w');
    fputcsv($out, ['ID', 'Timestamp', 'ECG_HR_BPM', 'MAX30102_PR_BPM', 'SpO2_%', 'Temp_C', 'Lead_Status', 'Signal_Validity']);
    
    foreach ($history as $row) {
        fputcsv($out, [
            $row['id'] ?? '',
            $row['timestamp'] ?? $row['created_at'] ?? '',
            $row['ecg_heart_rate'] ?? '',
            $row['max30102_pulse_rate'] ?? '',
            $row['spo2'] ?? '',
            $row['ir_temperature'] ?? '',
            $row['ecg_lead_status'] ?? '',
            $row['signal_validity'] ?? ''
        ]);
    }
    fclose($out);
    exit;
}

Response::success([
    'patient_id' => $patientId,
    'count'      => count($history),
    'history'    => array_reverse($history) // Chronological order
]);
