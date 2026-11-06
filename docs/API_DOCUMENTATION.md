# Backend API Documentation
**ESP32-Based Home Patient Monitoring System (Educational Prototype)**

---

## 1. Authentication & Security
- **Data Ingestion Endpoints** (used by ESP32 or MQTT Subscriber) require a Bearer token in the HTTP `Authorization` header:
  ```http
  Authorization: Bearer esp32_research_secret_token_2026
  ```
- **State-Changing Web Endpoints** (such as Manual Blood Pressure entry) require a CSRF token passed either in the `X-CSRF-Token` header or inside the request JSON (`csrf_token`).

---

## 2. Endpoints Summary

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/csrf.php` | Issue fresh CSRF token | None |
| `POST` | `/api/auth/login.php` | User session login | None |
| `POST` | `/api/auth/logout.php` | Terminate session | Session |
| `POST` | `/api/ingest/vitals.php` | Ingest periodic telemetry | Bearer Key |
| `POST` | `/api/ingest/ecg_batch.php` | Ingest batched ECG samples | Bearer Key |
| `GET` | `/api/vitals/latest.php` | Get latest telemetry & status | None / Read |
| `GET` | `/api/vitals/history.php` | Time-series vitals & CSV export | None / Read |
| `GET` | `/api/vitals/ecg_latest.php` | Latest recorded ECG batch | None / Read |
| `POST` | `/api/blood_pressure/manual_entry.php` | Submit manual BP reading | CSRF |
| `GET` | `/api/blood_pressure/list.php` | List manual BP entries | None / Read |
| `GET` | `/api/alerts/list.php` | Get alerts (active or history) | None / Read |
| `POST` | `/api/alerts/acknowledge.php` | Acknowledge an active alert | None / Session |
| `POST` | `/api/devices/status.php` | Device LWT / Heartbeat update | Bearer Key |

---

## 3. Ingestion Endpoints (ESP32 / MQTT Bridge)

### A. Low-Frequency Telemetry Ingestion
* **Endpoint:** `POST /api/ingest/vitals.php`
* **Headers:**
  ```http
  Content-Type: application/json
  Authorization: Bearer esp32_research_secret_token_2026
  ```
* **Request Payload (JSON):**
  ```json
  {
    "device_uid": "ESP32-NODE-01",
    "patient_id": 1,
    "ecg_heart_rate": 74,
    "max30102_pulse_rate": 72,
    "spo2": 98.0,
    "ir_temperature": 36.65,
    "ecg_lead_status": "normal",
    "ppg_finger_detected": 1,
    "battery_level": 92,
    "wifi_rssi": -64,
    "timestamp": "2026-11-02 17:30:00"
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Vitals telemetry recorded successfully.",
    "timestamp": "2026-11-02T17:30:01+06:00",
    "data": {
      "reading_id": 482,
      "device_id": 1,
      "patient_id": 1,
      "device_status": "online",
      "alerts_checked": 0
    }
  }
  ```

---

### B. High-Speed ECG Batch Ingestion
* **Endpoint:** `POST /api/ingest/ecg_batch.php`
* **Purpose:** Stores an array of sampled millivolt readings to prevent database overloading.
* **Request Payload (JSON):**
  ```json
  {
    "device_uid": "ESP32-NODE-01",
    "patient_id": 1,
    "sample_rate_hz": 125,
    "lead_name": "Lead-II",
    "start_time": "2026-11-02 17:30:00.000",
    "end_time": "2026-11-02 17:30:01.000",
    "samples": [-0.05, 0.02, 0.18, 0.95, -0.22, 0.25, 0.01]
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "ECG batch ingested successfully.",
    "data": {
      "batch_id": 105,
      "sample_count": 7,
      "rate_hz": 125
    }
  }
  ```

---

## 4. Frontend Retrieval Endpoints

### A. Get Latest Patient Telemetry
* **Endpoint:** `GET /api/vitals/latest.php?patient_id=1`
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "prototype_notice": "Educational Prototype — Not for Diagnosis",
      "patient": {
        "id": 1,
        "patient_code": "PT-8802",
        "full_name": "Robert Vance",
        "room_bed": "Bed 04 / Room 402"
      },
      "device": {
        "device_uid": "ESP32-NODE-01",
        "status": "online",
        "battery_level": 92,
        "wifi_rssi": -64,
        "seconds_since_last_seen": 2
      },
      "latest_vitals": {
        "ecg_heart_rate": 74,
        "max30102_pulse_rate": 72,
        "spo2": "98.0",
        "ir_temperature": "36.65",
        "ecg_lead_status": "normal",
        "ppg_finger_detected": 1,
        "signal_validity": "valid",
        "reading_timestamp": "2026-11-02 17:30:00"
      },
      "latest_manual_bp": {
        "systolic_bp": 120,
        "diastolic_bp": 80,
        "pulse_rate": 72,
        "data_source": "manual_entry",
        "measurement_timestamp": "2026-11-02 10:15:00"
      },
      "active_alerts_count": 0
    }
  }
  ```

---

### B. Manual Blood Pressure Entry
* **Endpoint:** `POST /api/blood_pressure/manual_entry.php`
* **Headers:**
  ```http
  Content-Type: application/json
  X-CSRF-Token: <CSRF_TOKEN_STRING>
  ```
* **Request Payload (JSON):**
  ```json
  {
    "patient_id": 1,
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "pulse_rate": 72,
    "measurement_timestamp": "2026-11-02 17:15:00",
    "notes": "Patient seated, left brachial artery cuff."
  }
  ```
