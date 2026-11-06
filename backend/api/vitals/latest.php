<?php
/**
 * Controller: Latest Telemetry Aggregator for Dashboard Polling
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Services/TelemetryService.php';

use App\Core\Response;
use App\Core\Request;
use App\Services\TelemetryService;

$request = new Request();
$patientId = $request->get('patient_id', 'PT-8802');

$telemetryService = new TelemetryService();
$dashboardData = $telemetryService->getDashboardTelemetry($patientId);

Response::success($dashboardData, 'Dashboard telemetry fetched');
