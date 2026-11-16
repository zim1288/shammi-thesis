<?php
/**
 * Controller: Alerts List
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Repositories/AlertRepository.php';
require_once __DIR__ . '/../../src/Repositories/PatientRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Repositories\AlertRepository;
use App\Repositories\PatientRepository;

$request = new Request();
$patientId = $request->get('patient_id', '');
$patientRepo = new PatientRepository();

if (empty($patientId)) {
    $all = $patientRepo->getAll();
    $patientId = !empty($all) ? ($all[0]['id'] ?? $all[0]['patient_code']) : 'UNASSIGNED';
}
$activeOnly = (bool)$request->get('active_only', 0);
$limit      = min((int)$request->get('limit', 30), 100);

$patient = !empty($patientId) ? $patientRepo->findById($patientId) : null;
$targetCode = $patient['patient_code'] ?? null;
$targetId   = $patient['id'] ?? null;

$alertRepo = new AlertRepository();
$alerts = $alertRepo->listAlerts($patientId, $activeOnly, $limit);
if (empty($alerts) && !empty($targetCode)) {
    $alerts = $alertRepo->listAlerts($targetCode, $activeOnly, $limit);
}
if (empty($alerts) && !empty($targetId)) {
    $alerts = $alertRepo->listAlerts($targetId, $activeOnly, $limit);
}

Response::success([
    'patient_id' => $patientId,
    'count'      => count($alerts),
    'alerts'     => $alerts
]);
