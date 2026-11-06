<?php
/**
 * Controller: List Manual Blood Pressure Entries
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Repositories/BloodPressureRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Repositories\BloodPressureRepository;

$request = new Request();
$patientId = $request->get('patient_id', 'PT-8802');
$limit     = min((int)$request->get('limit', 50), 200);
$format    = strtolower($request->get('format', 'json'));

$bpRepo = new BloodPressureRepository();
$records = $bpRepo->listRecords($patientId, $limit);

// CSV Export Support for Manual Entries
if ($format === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=patient_' . $patientId . '_manual_bp_' . date('Ymd_His') . '.csv');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['ID', 'Measurement_Time', 'Systolic_mmHg', 'Diastolic_mmHg', 'Pulse_BPM', 'Recorded_By', 'Notes', 'Data_Source']);
    foreach ($records as $r) {
        fputcsv($out, [
            $r['id'] ?? '',
            $r['measurement_timestamp'] ?? $r['created_at'] ?? '',
            $r['systolic_bp'] ?? '',
            $r['diastolic_bp'] ?? '',
            $r['pulse_rate'] ?? '',
            $r['recorded_by'] ?? '',
            $r['notes'] ?? '',
            $r['data_source'] ?? 'manual_entry'
        ]);
    }
    fclose($out);
    exit;
}

Response::success([
    'patient_id' => $patientId,
    'count'      => count($records),
    'records'    => $records
]);
