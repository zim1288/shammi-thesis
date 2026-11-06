<?php
/**
 * MongoDB Atlas & Local Connection Configuration
 * ESP32 Home Patient Monitoring System
 */

// MongoDB Connection URI:
// For MongoDB Atlas, use your cluster connection string:
// e.g. "mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
// For local MongoDB, use: "mongodb://127.0.0.1:27017"
define(
    'MONGO_URI',
    getenv('MONGO_URI') ?: 'mongodb://127.0.0.1:27017'
);

// Database Name
define(
    'MONGO_DB_NAME',
    getenv('MONGO_DB_NAME') ?: 'patient_monitor'
);

// Connection Driver Options
define('MONGO_OPTIONS', [
    'connectTimeoutMS' => 5000,
    'socketTimeoutMS'  => 10000,
    'serverSelectionTimeoutMS' => 5000,
    'appname'          => 'ESP32PatientMonitor'
]);
