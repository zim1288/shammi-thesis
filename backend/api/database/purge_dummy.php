<?php
/**
 * Controller: Purge Legacy Dummy Data (Robert Vance / PT-8802)
 * ESP32 Home Patient Monitoring System
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/MongoConnection.php';

use App\Core\Response;
use App\Core\MongoConnection;

$db = MongoConnection::getInstance();

$deletedPatients = $db->delete('patients', ['patient_code' => 'PT-8802']);
$deletedVance    = $db->delete('patients', ['full_name' => 'Robert Vance']);
$deletedReadings = $db->delete('sensor_readings', ['patient_id' => 'PT-8802']);
$deletedBp       = $db->delete('manual_blood_pressure', ['patient_id' => 'PT-8802']);
$deletedEcg      = $db->delete('ecg_batches', ['patient_id' => 'PT-8802']);
$deletedAlerts   = $db->delete('alerts', ['patient_id' => 'PT-8802']);

// Reset assigned device
$db->update('devices', ['assigned_patient_id' => 'PT-8802'], [
    'assigned_patient_id' => null,
    'status'              => 'offline'
]);

Response::success([
    'storage_mode'      => $db->getStatus()['storage_mode'],
    'deleted_patients'  => ($deletedPatients + $deletedVance),
    'deleted_readings'  => $deletedReadings,
    'deleted_bp'        => $deletedBp,
    'deleted_ecg'       => $deletedEcg,
    'deleted_alerts'    => $deletedAlerts
], 'Legacy dummy data (Robert Vance / PT-8802) completely purged');
