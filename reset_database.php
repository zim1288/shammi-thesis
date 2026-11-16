<?php
/**
 * CLI Tool: Database Reset & Collection Hygiene
 * ESP32 Home Patient Monitoring System
 *
 * Usage:
 *   php reset_database.php --status
 *   php reset_database.php --all
 *   php reset_database.php --all --preserve-patients
 *   php reset_database.php --collection=alerts
 */

require_once __DIR__ . '/backend/src/Core/MongoConnection.php';

use App\Core\MongoConnection;

$db = MongoConnection::getInstance();
$status = $db->getStatus();

$collections = [
    'alerts',
    'sensor_readings',
    'ecg_batches',
    'live_readings',
    'manual_blood_pressure',
    'devices',
    'patients'
];

echo "\n======================================================\n";
echo " ESP32 Patient Monitor — Database Reset & Hygiene CLI\n";
echo "======================================================\n";
echo "Storage Mode: " . ($status['storage_mode'] ?? 'unknown') . "\n";
echo "Database:     " . ($status['database_name'] ?? 'patient_monitor') . "\n";
echo "Connected:    " . ($status['connected'] ? "YES (Live Atlas)" : "NO (Local Fallback)") . "\n";
echo "------------------------------------------------------\n";

$args = $argv;
array_shift($args); // remove script name

$action = 'status';
$targetCol = '';
$preservePatients = false;

foreach ($args as $arg) {
    if ($arg === '--all') {
        $action = 'all';
    } elseif ($arg === '--preserve-patients') {
        $preservePatients = true;
    } elseif (strpos($arg, '--collection=') === 0) {
        $action = 'collection';
        $targetCol = substr($arg, 13);
    } elseif ($arg === '--status') {
        $action = 'status';
    } elseif (in_array($arg, $collections, true)) {
        $action = 'collection';
        $targetCol = $arg;
    }
}

// Action 1: Status
if ($action === 'status') {
    echo "Current Collection Statistics:\n";
    $total = 0;
    foreach ($collections as $col) {
        $count = $db->count($col);
        $total += $count;
        printf("  - %-25s : %d documents\n", $col, $count);
    }
    echo "------------------------------------------------------\n";
    echo "Total Documents: {$total}\n\n";
    echo "To reset all collections:            php reset_database.php --all\n";
    echo "To reset all except patients/devices: php reset_database.php --all --preserve-patients\n";
    echo "To reset a single collection:        php reset_database.php alerts\n\n";
    exit(0);
}

// Action 2: Reset Single Collection
if ($action === 'collection') {
    if (!in_array($targetCol, $collections, true)) {
        echo "Error: Unknown collection '{$targetCol}'. Allowed: " . implode(', ', $collections) . "\n\n";
        exit(1);
    }

    echo "Clearing documents from '{$targetCol}'...\n";
    $deleted = $db->clearCollection($targetCol);
    $remaining = $db->count($targetCol);
    echo "Done! Deleted {$deleted} documents. Remaining: {$remaining}.\n";
    echo "Collection '{$targetCol}' remains ready and intact.\n\n";
    exit(0);
}

// Action 3: Reset All Collections
if ($action === 'all') {
    echo "Clearing all documents across collections...\n";
    $totalDeleted = 0;
    foreach ($collections as $col) {
        if ($preservePatients && in_array($col, ['patients', 'devices'], true)) {
            echo "  - [SKIPPED]  {$col} (preserved)\n";
            continue;
        }
        $deleted = $db->clearCollection($col);
        $totalDeleted += $deleted;
        echo "  - [CLEARED]  {$col} ({$deleted} docs purged)\n";
    }
    echo "------------------------------------------------------\n";
    echo "Master Reset Complete! Total documents deleted: {$totalDeleted}\n";
    echo "All collections remain ready and intact in MongoDB.\n\n";
    exit(0);
}
