<?php
namespace App\Repositories;

require_once __DIR__ . '/../Core/MongoConnection.php';

use App\Core\MongoConnection;

/**
 * Sensor Readings Document Repository (Low-Frequency Vitals)
 */
class VitalsRepository {
    private MongoConnection $db;
    private string $collection = 'sensor_readings';

    public function __construct() {
        $this->db = MongoConnection::getInstance();
    }

    public function insertReading(array $reading): string {
        $reading['created_at'] = $reading['created_at'] ?? date('c');
        return $this->db->insert($this->collection, $reading);
    }

    public function getLatestByPatient(string $patientId): ?array {
        return $this->db->findOne(
            $this->collection,
            ['patient_id' => $patientId],
            ['sort' => ['created_at' => -1]]
        );
    }

    public function getHistory(string $patientId, int $limit = 50): array {
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
