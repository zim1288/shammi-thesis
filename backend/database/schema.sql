-- ============================================================================
-- ESP32-Based Home Patient Monitoring System
-- Database Schema for MySQL 5.7+ / 8.0+ / MariaDB
-- Purpose: Research & Educational Prototype
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `patient_monitor` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `patient_monitor`;

-- ----------------------------------------------------------------------------
-- 1. Table: user_accounts
-- Purpose: System authentication and role-based access
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_accounts` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `role` ENUM('admin', 'researcher', 'doctor', 'patient') NOT NULL DEFAULT 'researcher',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_username` (`username`),
  INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Table: patients
-- Purpose: Demographic and clinical record of subjects/patients
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `patients` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `patient_code` VARCHAR(30) NOT NULL UNIQUE COMMENT 'Unique identifier e.g. PT-8802',
  `full_name` VARCHAR(100) NOT NULL,
  `age` SMALLINT UNSIGNED NULL,
  `gender` ENUM('Male', 'Female', 'Other') NOT NULL DEFAULT 'Other',
  `room_bed` VARCHAR(50) NULL COMMENT 'e.g. Bed 04 / Room 402',
  `medical_notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_patient_code` (`patient_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Table: devices
-- Purpose: ESP32 hardware registry, heartbeats, and MQTT state
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `devices` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `device_uid` VARCHAR(60) NOT NULL UNIQUE COMMENT 'e.g. ESP32-NODE-01 or MAC address',
  `device_name` VARCHAR(100) NOT NULL DEFAULT 'ESP32 Vital Node',
  `assigned_patient_id` INT UNSIGNED NULL,
  `status` ENUM('online', 'offline', 'error') NOT NULL DEFAULT 'offline',
  `battery_level` TINYINT UNSIGNED NULL COMMENT 'Battery % (0-100)',
  `wifi_rssi` SMALLINT NULL COMMENT 'WiFi signal in dBm',
  `ip_address` VARCHAR(45) NULL,
  `firmware_version` VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  `last_heartbeat` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`assigned_patient_id`) REFERENCES `patients`(`id`) ON DELETE SET NULL,
  INDEX `idx_device_uid` (`device_uid`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Table: sensor_readings
-- Purpose: Periodic low-frequency vitals telemetry (from ESP32 / MQTT bridge)
-- Note: ECG Heart Rate and MAX30102 Pulse Rate are stored in separate columns
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sensor_readings` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `device_id` INT UNSIGNED NOT NULL,
  `patient_id` INT UNSIGNED NOT NULL,
  
  -- Distinct Heart Rate / Pulse metrics
  `ecg_heart_rate` SMALLINT UNSIGNED NULL COMMENT 'BPM derived from AD8232 ECG R-R interval',
  `max30102_pulse_rate` SMALLINT UNSIGNED NULL COMMENT 'BPM derived from MAX30102 optical PPG',
  
  -- Other physiological vitals
  `spo2` DECIMAL(4, 1) NULL COMMENT 'Oxygen saturation percentage (0-100%)',
  `ir_temperature` DECIMAL(4, 2) NULL COMMENT 'IR skin surface temperature in Celsius',
  
  -- Hardware Signal Validity & Lead Contact Flags
  `ecg_lead_status` ENUM('normal', 'lead_off_pos', 'lead_off_neg', 'lead_off_both', 'unknown') NOT NULL DEFAULT 'normal',
  `ppg_finger_detected` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = Finger detected on MAX30102, 0 = No contact',
  `signal_validity` ENUM('valid', 'degraded', 'invalid') NOT NULL DEFAULT 'valid',
  
  `reading_timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE,
  INDEX `idx_patient_time` (`patient_id`, `reading_timestamp`),
  INDEX `idx_device_time` (`device_id`, `reading_timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Table: ecg_batches
-- Purpose: Batched high-frequency ECG waveform samples (100-250 Hz)
-- Avoids inserting individual millivolt samples as single DB rows.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ecg_batches` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `device_id` INT UNSIGNED NOT NULL,
  `patient_id` INT UNSIGNED NOT NULL,
  `sample_rate_hz` SMALLINT UNSIGNED NOT NULL DEFAULT 125 COMMENT 'Samples per second (e.g. 125Hz or 250Hz)',
  `sample_count` SMALLINT UNSIGNED NOT NULL COMMENT 'Number of samples in this batch',
  `samples_json` MEDIUMTEXT NOT NULL COMMENT 'JSON array of mV values e.g. [-0.12, 0.05, 0.85, ...]',
  `batch_start_time` DATETIME(3) NOT NULL,
  `batch_end_time` DATETIME(3) NOT NULL,
  `lead_name` VARCHAR(10) NOT NULL DEFAULT 'Lead-II',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE,
  INDEX `idx_ecg_patient_time` (`patient_id`, `batch_start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Table: manual_blood_pressure
-- Purpose: Manual Blood Pressure records (strictly separated from automatic sensors)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `manual_blood_pressure` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `patient_id` INT UNSIGNED NOT NULL,
  `systolic_bp` SMALLINT UNSIGNED NOT NULL COMMENT 'Systolic BP in mmHg',
  `diastolic_bp` SMALLINT UNSIGNED NOT NULL COMMENT 'Diastolic BP in mmHg',
  `pulse_rate` SMALLINT UNSIGNED NULL COMMENT 'Optional manual pulse reading',
  `measurement_timestamp` DATETIME NOT NULL,
  `notes` VARCHAR(255) NULL COMMENT 'Notes (e.g. Patient resting, Left arm)',
  `recorded_by_user_id` INT UNSIGNED NULL,
  `data_source` VARCHAR(30) NOT NULL DEFAULT 'manual_entry',
  `is_valid` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`recorded_by_user_id`) REFERENCES `user_accounts`(`id`) ON DELETE SET NULL,
  INDEX `idx_bp_patient_time` (`patient_id`, `measurement_timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. Table: alert_history
-- Purpose: Physiological threshold & hardware disconnect alerts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `alert_history` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `patient_id` INT UNSIGNED NOT NULL,
  `device_id` INT UNSIGNED NULL,
  `alert_type` ENUM(
    'tachycardia', 
    'bradycardia', 
    'low_spo2', 
    'hypothermia', 
    'hyperthermia', 
    'hypertension', 
    'hypotension', 
    'lead_off', 
    'finger_removed', 
    'device_offline', 
    'signal_invalid'
  ) NOT NULL,
  `severity` ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'warning',
  `message` VARCHAR(255) NOT NULL,
  `threshold_value` VARCHAR(50) NULL,
  `actual_value` VARCHAR(50) NULL,
  `is_acknowledged` TINYINT(1) NOT NULL DEFAULT 0,
  `acknowledged_by_user_id` INT UNSIGNED NULL,
  `acknowledged_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`acknowledged_by_user_id`) REFERENCES `user_accounts`(`id`) ON DELETE SET NULL,
  INDEX `idx_alert_status` (`patient_id`, `is_acknowledged`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SEED DATA (For educational/research testing)
-- Default Login:
-- Username: admin
-- Password: Password123!  (Hash generated via password_hash('Password123!', PASSWORD_BCRYPT))
-- ============================================================================

INSERT INTO `user_accounts` (`id`, `username`, `email`, `password_hash`, `full_name`, `role`) VALUES
(1, 'admin', 'admin@monitoring.local', '$2y$10$w8571jT5K4f5Z.5Qn0Gg8.Xg3hL2NqD5h2Z4bZ0G1wZgG6b8Y8a0K', 'Lead Researcher', 'admin'),
(2, 'nurse01', 'nurse01@monitoring.local', '$2y$10$w8571jT5K4f5Z.5Qn0Gg8.Xg3hL2NqD5h2Z4bZ0G1wZgG6b8Y8a0K', 'Staff Nurse Jane', 'doctor');

-- Default Subject/Patient
INSERT INTO `patients` (`id`, `patient_code`, `full_name`, `age`, `gender`, `room_bed`, `medical_notes`) VALUES
(1, 'PT-8802', 'Robert Vance', 58, 'Male', 'Bed 04 / Room 402', 'Baseline sinus rhythm monitoring under research protocol #ESP-2026.');

-- Default ESP32 Device
INSERT INTO `devices` (`id`, `device_uid`, `device_name`, `assigned_patient_id`, `status`, `battery_level`, `wifi_rssi`, `ip_address`, `firmware_version`, `last_heartbeat`) VALUES
(1, 'ESP32-NODE-01', 'Clinical Bedside Node 01', 1, 'online', 92, -64, '192.168.1.145', '1.2.0', NOW());

-- Initial Manual Blood Pressure Baseline
INSERT INTO `manual_blood_pressure` (`patient_id`, `systolic_bp`, `diastolic_bp`, `pulse_rate`, `measurement_timestamp`, `notes`, `recorded_by_user_id`) VALUES
(1, 120, 80, 72, NOW(), 'Baseline seated brachial artery cuff measurement.', 1);

-- Initial Baseline Vitals
INSERT INTO `sensor_readings` (`device_id`, `patient_id`, `ecg_heart_rate`, `max30102_pulse_rate`, `spo2`, `ir_temperature`, `ecg_lead_status`, `ppg_finger_detected`, `signal_validity`, `reading_timestamp`) VALUES
(1, 1, 74, 72, 98.0, 36.65, 'normal', 1, 'valid', NOW());
