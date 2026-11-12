<?php
namespace App\Repositories;

require_once __DIR__ . '/../Core/MongoConnection.php';

use App\Core\MongoConnection;

/**
 * ESP32 Hardware Device Repository
 */
class DeviceRepository {
    private MongoConnection $db;
    private string $collection = 'devices';

    public function __construct() {
        $this->db = MongoConnection::getInstance();
    }

    public function findByUid(string $deviceUid): ?array {
        return $this->db->findOne($this->collection, ['device_uid' => $deviceUid]);
    }

    public function updateTelemetry(string $deviceUid, array $telemetry): int {
        $existing = $this->findByUid($deviceUid);
        if (!$existing) {
            $this->create([
                'device_uid'          => $deviceUid,
                'device_name'         => "Wearable Node ({$deviceUid})",
                'assigned_patient_id' => null,
                'mac_address'         => $telemetry['mac_address'] ?? 'Auto-detected',
                'status'              => 'online',
                'battery_level'       => isset($telemetry['battery_level']) ? (int)$telemetry['battery_level'] : null,
                'wifi_rssi'           => isset($telemetry['wifi_rssi']) ? (int)$telemetry['wifi_rssi'] : null,
                'ip_address'          => $telemetry['ip_address'] ?? ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'),
                'firmware_version'    => '1.2.0',
                'last_heartbeat'      => date('c'),
                'created_at'          => date('c')
            ]);
            return 1;
        }

        $update = [
            'status'         => 'online',
            'last_heartbeat' => date('c')
        ];
        if (isset($telemetry['battery_level'])) {
            $update['battery_level'] = (int)$telemetry['battery_level'];
        }
        if (isset($telemetry['wifi_rssi'])) {
            $update['wifi_rssi'] = (int)$telemetry['wifi_rssi'];
        }
        if (isset($telemetry['ip_address'])) {
            $update['ip_address'] = $telemetry['ip_address'];
        }

        return $this->db->update($this->collection, ['device_uid' => $deviceUid], $update);
    }

    public function updateStatus(string $deviceUid, string $status): int {
        return $this->db->update(
            $this->collection, 
            ['device_uid' => $deviceUid], 
            ['status' => $status, 'last_heartbeat' => date('c')]
        );
    }

    public function assignToPatient(string $deviceUid, string $patientId): int {
        return $this->db->update(
            $this->collection,
            ['device_uid' => $deviceUid],
            ['assigned_patient_id' => $patientId]
        );
    }

    public function unassignPatient(string $deviceUid): int {
        return $this->db->update(
            $this->collection,
            ['device_uid' => $deviceUid],
            ['assigned_patient_id' => null, 'status' => 'offline']
        );
    }

    public function unassignByPatientId(string $patientId): int {
        return $this->db->update(
            $this->collection,
            ['assigned_patient_id' => $patientId],
            ['assigned_patient_id' => null, 'status' => 'offline']
        );
    }

    public function create(array $deviceData): string {
        return $this->db->insert($this->collection, $deviceData);
    }
}
