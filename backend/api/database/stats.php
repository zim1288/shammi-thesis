<?php
/**
 * Controller: Database & Collection Statistics
 * ESP32 Home Patient Monitoring System
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/MongoConnection.php';

use App\Core\Response;
use App\Core\MongoConnection;

$db = MongoConnection::getInstance();
$status = $db->getStatus();

$collectionDefinitions = [
    'alerts' => [
        'name'        => 'alerts',
        'label'       => 'Physiological Alerts & Alarms',
        'description' => 'Threshold breaches, lead disconnects, and sensor disconnections',
        'icon'        => 'ri-alarm-warning-line',
        'category'    => 'telemetry'
    ],
    'sensor_readings' => [
        'name'        => 'sensor_readings',
        'label'       => 'Continuous Sensor Telemetry',
        'description' => 'SpO2, heart rate, and body temperature time-series samples',
        'icon'        => 'ri-pulse-line',
        'category'    => 'telemetry'
    ],
    'ecg_batches' => [
        'name'        => 'ecg_batches',
        'label'       => 'ECG Rhythm Batches',
        'description' => 'High-frequency Lead-II analog waveform batch buffers',
        'icon'        => 'ri-heart-pulse-line',
        'category'    => 'telemetry'
    ],
    'live_readings' => [
        'name'        => 'live_readings',
        'label'       => 'Real-Time State Cache',
        'description' => 'Latest live telemetry snapshot per active patient device',
        'icon'        => 'ri-broadcast-line',
        'category'    => 'telemetry'
    ],
    'manual_blood_pressure' => [
        'name'        => 'manual_blood_pressure',
        'label'       => 'Manual Blood Pressure Logs',
        'description' => 'Clinician-entered systolic, diastolic, and MAP entries',
        'icon'        => 'ri-stethoscope-line',
        'category'    => 'clinical'
    ],
    'devices' => [
        'name'        => 'devices',
        'label'       => 'IoT Hardware Nodes',
        'description' => 'Registered ESP32 microcontrollers and patient assignments',
        'icon'        => 'ri-cpu-line',
        'category'    => 'hardware'
    ],
    'patients' => [
        'name'        => 'patients',
        'label'       => 'Patient Profiles & Roster',
        'description' => 'Enrolled clinical patient metadata and room assignments',
        'icon'        => 'ri-user-heart-line',
        'category'    => 'clinical'
    ]
];

$collectionsData = [];
$totalDocs = 0;

foreach ($collectionDefinitions as $colName => $def) {
    $count = $db->count($colName);
    $totalDocs += $count;
    $def['count'] = $count;
    $collectionsData[] = $def;
}

Response::success([
    'database_name'    => $status['database_name'] ?? 'patient_monitor',
    'storage_mode'     => $status['storage_mode'] ?? 'Unknown',
    'is_connected'     => $status['connected'] ?? false,
    'total_documents'  => $totalDocs,
    'collections'      => $collectionsData
], 'Database collection statistics retrieved successfully');
