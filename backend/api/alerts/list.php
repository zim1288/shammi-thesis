<?php
/**
 * Controller: Alerts List
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Repositories/AlertRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Repositories\AlertRepository;

$request = new Request();
$patientId  = $request->get('patient_id', 'PT-8802');
$activeOnly = (bool)$request->get('active_only', 0);
$limit      = min((int)$request->get('limit', 30), 100);

$alertRepo = new AlertRepository();
$alerts = $alertRepo->listAlerts($patientId, $activeOnly, $limit);

Response::success([
    'patient_id' => $patientId,
    'count'      => count($alerts),
    'alerts'     => $alerts
]);
