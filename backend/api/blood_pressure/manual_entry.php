<?php
/**
 * Controller: Secure Manual Blood Pressure Submission
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Core/Security.php';
require_once __DIR__ . '/../../src/Repositories/BloodPressureRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Core\Security;
use App\Repositories\BloodPressureRepository;

$request = new Request();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method Not Allowed. POST required.', 405);
}

// 1. Verify CSRF Token (enforced when clinician session is active)
Security::enforceCsrf($request);

// 2. Validate clinical ranges
$systolicBp  = (int)$request->get('systolic_bp', 0);
$diastolicBp = (int)$request->get('diastolic_bp', 0);
$patientId   = $request->get('patient_id', 'PT-8802');

if ($systolicBp < 50 || $systolicBp > 260) {
    Response::error('Systolic BP must be between 50 and 260 mmHg.', 422);
}

if ($diastolicBp < 30 || $diastolicBp > 160) {
    Response::error('Diastolic BP must be between 30 and 160 mmHg.', 422);
}

if ($systolicBp <= $diastolicBp) {
    Response::error('Systolic BP must be strictly greater than Diastolic BP.', 422);
}

// 3. Store in Segregated Repository
$bpRepo = new BloodPressureRepository();
$recordId = $bpRepo->insertRecord([
    'patient_id'            => $patientId,
    'systolic_bp'           => $systolicBp,
    'diastolic_bp'          => $diastolicBp,
    'pulse_rate'            => $request->get('pulse_rate'),
    'measurement_timestamp' => $request->get('measurement_timestamp', date('c')),
    'notes'                 => $request->get('notes', ''),
    'recorded_by'           => $request->get('recorded_by_name') ?: ($_SESSION['full_name'] ?? 'Staff Nurse')
]);

Response::success([
    'record_id'    => $recordId,
    'data_source'  => 'manual_entry',
    'systolic_bp'  => $systolicBp,
    'diastolic_bp' => $diastolicBp
], 'Manual blood pressure measurement saved securely', 201);
