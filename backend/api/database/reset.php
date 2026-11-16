<?php
/**
 * Controller: Targeted or Global Dataset Reset Manager
 * ESP32 Home Patient Monitoring System
 * 
 * Safely purges documents from specified collections while keeping
 * collection structures, indexes, and schema definitions completely intact.
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Core/Security.php';
require_once __DIR__ . '/../../src/Core/MongoConnection.php';

use App\Core\Response;
use App\Core\Request;
use App\Core\Security;
use App\Core\MongoConnection;

$request = new Request();
$method = $request->getMethod();

if ($method !== 'POST') {
    Response::error('Only POST requests are allowed for database reset operations.', 405);
}

// CSRF check for browser-originated requests
Security::enforceCsrf($request);

$db = MongoConnection::getInstance();

$allowedCollections = [
    'alerts',
    'sensor_readings',
    'ecg_batches',
    'live_readings',
    'manual_blood_pressure',
    'devices',
    'patients'
];

$body = $request->getBody();
$action = trim($body['action'] ?? $request->get('action', ''));
$collection = trim($body['collection'] ?? $request->get('collection', ''));
$preservePatients = filter_var($body['preserve_patients'] ?? $request->get('preserve_patients', false), FILTER_VALIDATE_BOOLEAN);
$confirmText = trim($body['confirm_text'] ?? $request->get('confirm_text', ''));

if (strtoupper($confirmText) !== 'RESET') {
    Response::error('Safety verification failed. Please type "RESET" to confirm this operation.', 400);
}

// Case 1: Reset a Single Collection
if ($action === 'reset_collection') {
    if (empty($collection) || !in_array($collection, $allowedCollections, true)) {
        Response::error('Invalid or unapproved collection target specified: ' . htmlspecialchars($collection), 400);
    }

    $deletedCount = $db->clearCollection($collection);
    $newCount = $db->count($collection);

    Response::success([
        'action'          => 'reset_collection',
        'collection'      => $collection,
        'deleted_count'   => $deletedCount,
        'remaining_count' => $newCount
    ], "Collection '{$collection}' has been emptied successfully ({$deletedCount} documents deleted).");
}

// Case 2: Reset All Collections (Whole Dataset)
if ($action === 'reset_all') {
    $results = [];
    $totalDeleted = 0;

    foreach ($allowedCollections as $col) {
        // If clinician chose to preserve clinical roster & hardware registrations
        if ($preservePatients && in_array($col, ['patients', 'devices'], true)) {
            $results[$col] = [
                'skipped'         => true,
                'deleted_count'   => 0,
                'remaining_count' => $db->count($col)
            ];
            continue;
        }

        $deleted = $db->clearCollection($col);
        $totalDeleted += $deleted;
        $results[$col] = [
            'skipped'         => false,
            'deleted_count'   => $deleted,
            'remaining_count' => $db->count($col)
        ];
    }

    Response::success([
        'action'             => 'reset_all',
        'preserve_patients'  => $preservePatients,
        'total_deleted'      => $totalDeleted,
        'collection_results' => $results
    ], "Dataset reset completed successfully. Total documents purged: {$totalDeleted}.");
}

Response::error('Unrecognized action. Expected action="reset_collection" or action="reset_all".', 400);
