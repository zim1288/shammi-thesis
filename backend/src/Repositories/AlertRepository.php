<?php
namespace App\Repositories;

require_once __DIR__ . '/../Core/MongoConnection.php';

use App\Core\MongoConnection;

/**
 * Alert & Alarm History Repository
 */
class AlertRepository {
    private MongoConnection $db;
    private string $collection = 'alerts';

    public function __construct() {
        $this->db = MongoConnection::getInstance();
    }

    public function insertAlert(array $alert): string {
        $alert['is_acknowledged'] = false;
        $alert['acknowledged_at'] = null;
        $alert['created_at']      = date('c');
        return $this->db->insert($this->collection, $alert);
    }

    public function listAlerts(string $patientId, bool $activeOnly = false, int $limit = 30): array {
        $filter = ['patient_id' => $patientId];
        if ($activeOnly) {
            $filter['is_acknowledged'] = false;
        }

        return $this->db->query(
            $this->collection,
            $filter,
            [
                'sort'  => ['created_at' => -1],
                'limit' => $limit
            ]
        );
    }

    public function countActive(string $patientId): int {
        $alerts = $this->db->query($this->collection, [
            'patient_id'      => $patientId,
            'is_acknowledged' => false
        ]);
        return count($alerts);
    }

    public function acknowledge(string $alertId, string $userId = 'System'): int {
        return $this->db->update(
            $this->collection,
            ['id' => $alertId],
            [
                'is_acknowledged' => true,
                'acknowledged_at' => date('c'),
                'acknowledged_by' => $userId
            ]
        );
    }
}
