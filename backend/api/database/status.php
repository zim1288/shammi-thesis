<?php
/**
 * Controller: MongoDB Atlas Connection Status & Diagnostics
 * ESP32 Home Patient Monitoring System
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/MongoConnection.php';

use App\Core\Response;
use App\Core\MongoConnection;

$db = MongoConnection::getInstance();
Response::success($db->getStatus(), 'Database connection status retrieved');
