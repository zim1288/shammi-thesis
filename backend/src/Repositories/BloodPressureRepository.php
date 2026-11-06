<?php
namespace App\Repositories;

require_once __DIR__ . '/../Core/MongoConnection.php';

use App\Core\MongoConnection;

/**
 * Manual Blood Pressure Repository
 * Segregated strictly from automatic ESP32 telemetry with permanent source flag
 */
class BloodPressureRepository {
    private MongoConnection $db;
    private string $collection = 'manual_blood_pressure';

    public function __construct() {
        $this->db = MongoConnection::getInstance();
    }

    public function insertRecord(array $data): string {
        $record = [
            'patient_id'            => $data['patient_id'],
            'systolic_bp'           => (int)$data['systolic_bp'],
            'diastolic_bp'          => (int)$data['diastolic_bp'],
            'pulse_rate'            => !empty($data['pulse_rate']) ? (int)$data['pulse_rate'] : null,
            'measurement_timestamp' => $data['measurement_timestamp'] ?? date('c'),
            'notes'                 => $data['notes'] ?? '',
            'recorded_by'           => $data['recorded_by'] ?? 'Staff',
            'data_source'           => 'manual_entry',
            'is_valid'              => true,
            'created_at'            => date('c')
        ];

        return $this->db->insert($this->collection, $record);
    }

    public function getLatest(string $patientId): ?array {
        return $this->db->findOne(
            $this->collection,
            ['patient_id' => $patientId],
            ['sort' => ['created_at' => -1]]
        );
    }

    public function listRecords(string $patientId, int $limit = 30): array {
        return $this->db->query(
            $this->collection,
            ['patient_id' => $patientId],
            [
                'sort'  => ['created_at' => -1],
                'limit' => $limit
            ]
        );
    }
}
