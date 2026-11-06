<?php
/**
 * Controller: Latest Recorded ECG Waveform Batch
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Repositories/EcgBatchRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Repositories\EcgBatchRepository;

$request = new Request();
$patientId = $request->get('patient_id', 'PT-8802');

$repo = new EcgBatchRepository();
$latestBatch = $repo->getLatestBatch($patientId);

if (!$latestBatch) {
    Response::success([
        'has_data' => false,
        'samples'  => []
    ], 'No ECG batch recorded yet');
}

Response::success([
    'has_data'       => true,
    'batch_id'       => $latestBatch['id'] ?? '',
    'sample_rate_hz' => $latestBatch['sample_rate_hz'] ?? 125,
    'lead_name'      => $latestBatch['lead_name'] ?? 'Lead-II',
    'samples'        => $latestBatch['samples'] ?? []
]);
