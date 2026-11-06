<?php
namespace App\Repositories;

require_once __DIR__ . '/../Core/MongoConnection.php';

use App\Core\MongoConnection;

/**
 * High-Speed ECG Waveform Batch Repository
 */
class EcgBatchRepository {
    private MongoConnection $db;
    private string $collection = 'ecg_batches';

    public function __construct() {
        $this->db = MongoConnection::getInstance();
    }

    public function insertBatch(array $batch): string {
        $batch['created_at'] = $batch['created_at'] ?? date('c');
        return $this->db->insert($this->collection, $batch);
    }

    public function getLatestBatch(string $patientId): ?array {
        return $this->db->findOne(
            $this->collection,
            ['patient_id' => $patientId],
            ['sort' => ['created_at' => -1]]
        );
    }
}
