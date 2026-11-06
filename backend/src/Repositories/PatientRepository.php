<?php
namespace App\Repositories;

require_once __DIR__ . '/../Core/MongoConnection.php';

use App\Core\MongoConnection;

/**
 * Patient Document Repository
 */
class PatientRepository {
    private MongoConnection $db;
    private string $collection = 'patients';

    public function __construct() {
        $this->db = MongoConnection::getInstance();
    }

    public function findById(string $id): ?array {
        return $this->db->findOne($this->collection, ['id' => $id]) 
            ?: $this->db->findOne($this->collection, ['patient_code' => $id]);
    }

    public function getAll(array $filter = [], array $options = []): array {
        return $this->db->query($this->collection, $filter, $options);
    }

    public function create(array $patientData): string {
        if (empty($patientData['id'])) {
            $patientData['id'] = $patientData['patient_code'] ?? ('PT-' . rand(1000, 9999));
        }
        if (empty($patientData['created_at'])) {
            $patientData['created_at'] = date('c');
        }
        return $this->db->insert($this->collection, $patientData);
    }
}
