<?php
/**
 * Controller: Telemetry Ingestion (ESP32 HTTP Ingestion & MQTT Bridge)
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Core/Security.php';
require_once __DIR__ . '/../../src/Services/IngestionService.php';

use App\Core\Response;
use App\Core\Request;
use App\Core\Security;
use App\Services\IngestionService;

$request = new Request();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method Not Allowed. POST required.', 405);
}

// Ingestion Token Check
if (!Security::checkIngestAuthorization($request)) {
    Response::error('Unauthorized. Valid Bearer API Key required.', 401);
}

$payload = $request->getBody();

if (empty($payload)) {
    Response::error('Empty or invalid JSON body.', 422);
}

$ingestionService = new IngestionService();
$result = $ingestionService->processVitals($payload);

Response::success($result, 'Vitals telemetry recorded successfully', 201);
