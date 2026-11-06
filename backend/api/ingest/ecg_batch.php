<?php
/**
 * Controller: High-Speed ECG Batch Ingestion
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

if (empty($payload['samples']) || !is_array($payload['samples'])) {
    Response::error('Samples array is required.', 422);
}

$ingestionService = new IngestionService();
$result = $ingestionService->processEcgBatch($payload);

Response::success($result, 'ECG batch ingested successfully', 201);
