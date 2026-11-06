<?php
namespace App\Core;

require_once __DIR__ . '/../../config/mongodb.php';

use MongoDB\Driver\Manager;
use MongoDB\Driver\Query;
use MongoDB\Driver\BulkWrite;
use MongoDB\Driver\Command;
use MongoDB\Driver\Exception\Exception as MongoDriverException;
use MongoDB\BSON\ObjectId;

/**
 * Thread-Safe Singleton MongoDB Connection & Query Manager
 * Communicates with MongoDB Atlas or Local MongoDB using ext-mongodb
 */
class MongoConnection {
    private static ?MongoConnection $instance = null;
    private ?Manager $manager = null;
    private string $dbName;
    private bool $isConnected = false;
    private string $storageFallbackDir;

    private function __construct() {
        $this->dbName = MONGO_DB_NAME;
        $this->storageFallbackDir = __DIR__ . '/../../data_store/';

        if (!is_dir($this->storageFallbackDir)) {
            @mkdir($this->storageFallbackDir, 0755, true);
        }

        try {
            $this->manager = new Manager(MONGO_URI, MONGO_OPTIONS);
            // Execute quick ping to verify connection
            $pingCommand = new Command(['ping' => 1]);
            $this->manager->executeCommand($this->dbName, $pingCommand);
            $this->isConnected = true;
        } catch (\Throwable $e) {
            error_log("MongoDB Connection Warning: " . $e->getMessage() . ". Using JSON file storage mode.");
            $this->isConnected = false;
        }
    }

    public static function getInstance(): MongoConnection {
        if (self::$instance === null) {
            self::$instance = new MongoConnection();
        }
        return self::$instance;
    }

    public function isConnected(): bool {
        return $this->isConnected;
    }

    /**
     * Convert MongoDB BSON document / stdClass to clean standard array
     */
    private function cleanDocument($doc): array {
        $arr = json_decode(json_encode($doc), true);
        if (isset($arr['_id']['$oid'])) {
            $arr['id'] = $arr['_id']['$oid'];
            unset($arr['_id']);
        } elseif (isset($arr['_id'])) {
            $arr['id'] = (string)$arr['_id'];
            unset($arr['_id']);
        }
        return $arr;
    }

    /**
     * Query Documents
     */
    public function query(string $collection, array $filter = [], array $options = []): array {
        if ($this->isConnected && $this->manager) {
            try {
                $query = new Query($filter, $options);
                $cursor = $this->manager->executeQuery("{$this->dbName}.{$collection}", $query);
                $results = [];
                foreach ($cursor as $doc) {
                    $results[] = $this->cleanDocument($doc);
                }
                return $results;
            } catch (MongoDriverException $e) {
                error_log("MongoDB Query Error: " . $e->getMessage());
            }
        }

        // Fallback to local JSON collection store
        return $this->queryJsonFallback($collection, $filter, $options);
    }

    /**
     * Query Single Document
     */
    public function findOne(string $collection, array $filter = [], array $options = []): ?array {
        $options['limit'] = 1;
        $results = $this->query($collection, $filter, $options);
        return $results[0] ?? null;
    }

    /**
     * Insert Document
     */
    public function insert(string $collection, array $document): string {
        $genId = (string)new ObjectId();
        $document['_id'] = new ObjectId($genId);
        $document['created_at'] = $document['created_at'] ?? date('c');

        if ($this->isConnected && $this->manager) {
            try {
                $bulk = new BulkWrite();
                $bulk->insert($document);
                $this->manager->executeBulkWrite("{$this->dbName}.{$collection}", $bulk);
                return $genId;
            } catch (MongoDriverException $e) {
                error_log("MongoDB Insert Error: " . $e->getMessage());
            }
        }

        // Fallback to local JSON file store
        $document['id'] = $genId;
        unset($document['_id']);
        $this->insertJsonFallback($collection, $document);
        return $genId;
    }

    /**
     * Update Documents
     */
    public function update(string $collection, array $filter, array $updateData, array $options = ['multi' => false]): int {
        if ($this->isConnected && $this->manager) {
            try {
                $bulk = new BulkWrite();
                $bulk->update($filter, ['$set' => $updateData], $options);
                $result = $this->manager->executeBulkWrite("{$this->dbName}.{$collection}", $bulk);
                return $result->getModifiedCount();
            } catch (MongoDriverException $e) {
                error_log("MongoDB Update Error: " . $e->getMessage());
            }
        }

        return $this->updateJsonFallback($collection, $filter, $updateData);
    }

    /**
     * JSON File Fallback Engine
     * Keeps application working seamlessly even if MongoDB Atlas credentials are not yet configured!
     */
    private function getJsonFilePath(string $collection): string {
        $safeCollection = preg_replace('/[^a-zA-Z0-9_-]/', '', $collection);
        return $this->storageFallbackDir . $safeCollection . '.json';
    }

    private function readJsonCollection(string $collection): array {
        $file = $this->getJsonFilePath($collection);
        if (!file_exists($file)) {
            return [];
        }
        $data = json_decode(file_get_contents($file), true);
        return is_array($data) ? $data : [];
    }

    private function writeJsonCollection(string $collection, array $data): void {
        $file = $this->getJsonFilePath($collection);
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
    }

    private function insertJsonFallback(string $collection, array $document): void {
        $data = $this->readJsonCollection($collection);
        $data[] = $document;

        // Bounded retention window to avoid unbounded flat-file growth
        $maxItems = ($collection === 'sensor_readings') ? 1000 : (($collection === 'ecg_batches') ? 500 : 1000);
        if (count($data) > $maxItems) {
            $data = array_slice($data, -$maxItems);
        }

        $this->writeJsonCollection($collection, $data);
    }

    private function queryJsonFallback(string $collection, array $filter, array $options): array {
        $data = $this->readJsonCollection($collection);
        
        // Simple key-value filtering
        if (!empty($filter)) {
            $data = array_filter($data, function($item) use ($filter) {
                foreach ($filter as $key => $val) {
                    if (!isset($item[$key]) || $item[$key] != $val) {
                        return false;
                    }
                }
                return true;
            });
        }

        // Sorting
        if (isset($options['sort'])) {
            // Sort by first key
            foreach ($options['sort'] as $sortKey => $sortDir) {
                usort($data, function($a, $b) use ($sortKey, $sortDir) {
                    $valA = $a[$sortKey] ?? null;
                    $valB = $b[$sortKey] ?? null;
                    if ($valA == $valB) return 0;
                    if ($sortDir == -1) {
                        return ($valA > $valB) ? -1 : 1;
                    }
                    return ($valA < $valB) ? -1 : 1;
                });
                break;
            }
        }

        // Limit
        if (isset($options['limit']) && $options['limit'] > 0) {
            $data = array_slice($data, 0, (int)$options['limit']);
        }

        return array_values($data);
    }

    private function updateJsonFallback(string $collection, array $filter, array $updateData): int {
        $data = $this->readJsonCollection($collection);
        $count = 0;
        foreach ($data as &$item) {
            $match = true;
            foreach ($filter as $k => $v) {
                if (!isset($item[$k]) || $item[$k] != $v) {
                    $match = false;
                    break;
                }
            }
            if ($match) {
                foreach ($updateData as $upKey => $upVal) {
                    $item[$upKey] = $upVal;
                }
                $count++;
            }
        }
        $this->writeJsonCollection($collection, $data);
        return $count;
    }
}
