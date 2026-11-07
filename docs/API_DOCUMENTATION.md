# Production REST API Specification (v1 Contract)
### ESP32 Telemetry & Hospital Ward Decongestion System

This document specifies the frozen **API Contract (v1)** for independent development of the **ESP32 Firmware** and the **Web Application**.

---

## 1. Authentication & Token Architecture

The system uses separated authentication models tailored for IoT hardware vs. human clinicians:

### A. ESP32 Firmware Authentication (Pre-Shared Bearer Token)
* All ESP32 HTTP requests must include the research API key in the standard `Authorization` header:
  ```http
  Authorization: Bearer <YOUR_API_INGEST_KEY>
  Content-Type: application/json
  ```
* **Firmware Configuration:** Defined in your private `config.h` file (`#define API_BEARER_TOKEN "..."`), matched against Render's `API_INGEST_KEY`.
* **Backend Validation:** Validated via constant-time comparison in `App\Core\Security::checkIngestAuthorization($request)` against `API_INGEST_KEY` or the `API_KEY` environment variable.

### B. Web Clinician Authentication (Session + Anti-CSRF Token)
* **Session Cookie:** HTTP-Only, SameSite=Lax session cookie issued upon login/OTP verification.
* **CSRF Guard:** Browser write actions require `X-CSRF-Token` header generated via cryptographic `random_bytes(32)`.

---

## 2. API Endpoints Overview

| # | HTTP Method | Endpoint URL | Primary Consumer | Authentication | Description |
| :- | :--- | :--- | :--- | :--- | :--- |
| **1** | `POST` | `/api/v1/readings` | ESP32 Firmware | `Bearer Token` | Ingest periodic low-frequency sensor vitals |
| **2** | `POST` | `/api/v1/ecg` | ESP32 Firmware | `Bearer Token` | Ingest batched high-speed ECG samples (125 Hz) |
| **3** | `POST` | `/api/v1/blood-pressure` | Web Clinician | `CSRF Token / Session` | Log segregated manual bedside BP reading |
| **4** | `GET` | `/api/v1/latest` | Web Dashboard | Read Access | Get real-time aggregated patient telemetry |
| **5** | `GET` | `/api/v1/history` | Web Dashboard | Read Access | Query time-series telemetry or download research CSV |
| **6** | `GET` | `/api/v1/alerts` | Web Dashboard | Read Access | Query active or historical safety alarms |
| **7** | `GET` / `POST` | `/api/v1/device/status` | ESP32 / Dashboard | `Bearer Token` (POST) / Read (GET) | Query or update hardware heartbeat & battery |

---

## 3. Complete Endpoint Contracts (JSON Request & Response)

### 1. POST /api/v1/readings
Ingests periodic low-frequency physiological vitals from the ESP32 (MAX30102 PPG, MLX90614 IR Temp, AD8232 Lead status).

* **Headers:**
  ```http
  Content-Type: application/json
  Authorization: Bearer <YOUR_API_INGEST_KEY>
  ```
* **Request Payload (JSON):**
  ```json
  {
    "device_uid": "ESP32-NODE-01",
    "patient_id": "PT-8802",
    "ecg_heart_rate": 74,
    "max30102_pulse_rate": 73,
    "spo2": 98.4,
    "ir_temperature": 36.6,
    "ecg_lead_status": "normal",
    "ppg_finger_detected": 1,
    "battery_level": 92,
    "wifi_rssi": -64,
    "timestamp": "2026-11-06T15:30:00+06:00"
  }
  ```
* **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "ok": true,
    "message": "Vitals telemetry recorded successfully",
    "timestamp": "2026-11-06T15:30:01+06:00",
    "data": {
      "reading_id": "672b83f124a1b023f0a1c001",
      "patient_id": "PT-8802",
      "device_status": "online",
      "alerts_checked": 0
    }
  }
  ```

---

### 2. POST /api/v1/ecg
Ingests chunks of high-speed ECG Lead-II waveform samples collected by the AD8232 bio-amplifier.

* **Headers:**
  ```http
  Content-Type: application/json
  Authorization: Bearer <YOUR_API_INGEST_KEY>
  ```
* **Request Payload (JSON):**
  ```json
  {
    "device_uid": "ESP32-NODE-01",
    "patient_id": "PT-8802",
    "sample_rate_hz": 125,
    "lead_name": "Lead-II",
    "start_time": "2026-11-06T15:30:00.000+06:00",
    "end_time": "2026-11-06T15:30:01.000+06:00",
    "samples": [
      0.02, 0.05, 0.18, -0.14, 1.05, -0.30, 0.28, 0.01,
      0.04, 0.06, 0.21, -0.12, 1.12, -0.28, 0.25, 0.02
    ]
  }
  ```
* **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "ok": true,
    "message": "ECG batch ingested successfully",
    "timestamp": "2026-11-06T15:30:01+06:00",
    "data": {
      "batch_id": "672b83f124a1b023f0a1c002",
      "sample_count": 16,
      "rate_hz": 125
    }
  }
  ```

---

### 3. POST /api/v1/blood-pressure
Submits a manual clinical blood pressure observation from a clinician. Data is permanently segregated from automatic telemetry.

* **Headers:**
  ```http
  Content-Type: application/json
  X-CSRF-Token: <valid_csrf_token>
  ```
* **Request Payload (JSON):**
  ```json
  {
    "patient_id": "PT-8802",
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "pulse_rate": 72,
    "notes": "Post-stabilization recovery check.",
    "recorded_by": "Dr. S. Jenkins, MD"
  }
  ```
* **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "ok": true,
    "message": "Manual blood pressure record saved successfully",
    "timestamp": "2026-11-06T15:35:00+06:00",
    "data": {
      "record_id": "672b84f224a1b023f0a1c003",
      "patient_id": "PT-8802",
      "systolic_bp": 120,
      "diastolic_bp": 80,
      "data_source": "manual_entry"
    }
  }
  ```

---

### 4. GET /api/v1/latest
Returns single-patient real-time aggregated telemetry, including patient profile, hardware status, latest vitals, latest manual BP, and active alert counts.

* **Query Parameters:** `?patient_id=PT-8802`
* **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "ok": true,
    "message": "Dashboard telemetry fetched",
    "timestamp": "2026-11-06T15:35:10+06:00",
    "data": {
      "prototype_notice": "Educational Prototype — Not for Diagnosis",
      "patient": {
        "id": "PT-8802",
        "patient_code": "PT-8802",
        "full_name": "Robert Vance",
        "room_bed": "Discharged Home",
        "age": 58,
        "gender": "Male",
        "ward_origin": "ICU Step-Down"
      },
      "device": {
        "device_uid": "ESP32-NODE-01",
        "status": "online",
        "battery_level": 92,
        "wifi_rssi": -64,
        "last_heartbeat": "2026-11-06T15:35:05+06:00"
      },
      "latest_vitals": {
        "ecg_heart_rate": 74,
        "max30102_pulse_rate": 73,
        "spo2": 98.4,
        "ir_temperature": 36.6,
        "ecg_lead_status": "normal",
        "ppg_finger_detected": 1,
        "signal_validity": "valid",
        "timestamp": "2026-11-06T15:35:00+06:00"
      },
      "latest_manual_bp": {
        "systolic_bp": 120,
        "diastolic_bp": 80,
        "pulse_rate": 72,
        "data_source": "manual_entry",
        "recorded_by": "Dr. S. Jenkins, MD"
      },
      "active_alerts_count": 0,
      "server_time": "2026-11-06T15:35:10+06:00"
    }
  }
  ```

---

### 5. GET /api/v1/history
Fetches chronological timeseries telemetry records.

* **Query Parameters:** 
  * `patient_id` (string, default: `PT-8802`)
  * `limit` (integer, default: `50`, max: `1000`)
  * `format` (string: `json` or `csv`)
* **Response (`200 OK` for JSON):**
  ```json
  {
    "success": true,
    "ok": true,
    "message": "",
    "timestamp": "2026-11-06T15:35:20+06:00",
    "data": {
      "patient_id": "PT-8802",
      "count": 2,
      "history": [
        {
          "id": "672b83f124a1b023f0a1c001",
          "ecg_heart_rate": 74,
          "max30102_pulse_rate": 73,
          "spo2": 98.4,
          "ir_temperature": 36.6,
          "ecg_lead_status": "normal",
          "timestamp": "2026-11-06T15:30:00+06:00"
        }
      ]
    }
  }
  ```

---

### 6. GET /api/v1/alerts
Retrieves active or acknowledged safety alarms (tachycardia, bradycardia, hypoxia, lead detachment, hyperthermia).

* **Query Parameters:** 
  * `patient_id` (string, default: `PT-8802`)
  * `active_only` (`1` or `0`, default: `0`)
  * `limit` (integer, default: `30`, max: `100`)
* **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "ok": true,
    "message": "",
    "timestamp": "2026-11-06T15:35:30+06:00",
    "data": {
      "patient_id": "PT-8802",
      "count": 1,
      "alerts": [
        {
          "id": "672b85f224a1b023f0a1c008",
          "alert_type": "tachycardia",
          "severity": "critical",
          "message": "High Heart Rate (Tachycardia): 128 BPM",
          "threshold": "Max 120 BPM",
          "actual": "128 BPM",
          "is_acknowledged": false,
          "created_at": "2026-11-06T15:32:00+06:00"
        }
      ]
    }
  }
  ```

---

### 7. GET / POST /api/v1/device/status
Provides hardware health query and keepalive heartbeats.

* **GET Query Parameters:** `?device_uid=ESP32-NODE-01`
* **GET Response (`200 OK`):**
  ```json
  {
    "success": true,
    "ok": true,
    "message": "Device status retrieved successfully",
    "timestamp": "2026-11-06T15:35:40+06:00",
    "data": {
      "device_uid": "ESP32-NODE-01",
      "device_name": "Wearable Node (ESP32-NODE-01)",
      "assigned_patient_id": "PT-8802",
      "status": "online",
      "battery_level": 95,
      "wifi_rssi": -62,
      "firmware_version": "1.2.0",
      "last_heartbeat": "2026-11-06T15:35:30+06:00",
      "heartbeat_age_sec": 10
    }
  }
  ```
* **POST (Heartbeat update from ESP32):**
  * Headers: `Authorization: Bearer <YOUR_API_INGEST_KEY>`
  * Body: `{"device_uid": "ESP32-NODE-01", "status": "online"}`

---

## 4. MongoDB Collection Structure

The database maintains 6 collections with the following document schemas:

### Collection 1: `sensor_readings`
```json
{
  "_id": { "$oid": "672b83f124a1b023f0a1c001" },
  "patient_id": "PT-8802",
  "device_uid": "ESP32-NODE-01",
  "ecg_heart_rate": 74,
  "max30102_pulse_rate": 73,
  "spo2": 98.4,
  "ir_temperature": 36.6,
  "ecg_lead_status": "normal",
  "ppg_finger_detected": 1,
  "signal_validity": "valid",
  "battery_level": 92,
  "wifi_rssi": -64,
  "timestamp": "2026-11-06T15:30:00+06:00",
  "created_at": "2026-11-06T15:30:00+06:00"
}
```

### Collection 2: `ecg_batches`
```json
{
  "_id": { "$oid": "672b83f124a1b023f0a1c002" },
  "patient_id": "PT-8802",
  "device_uid": "ESP32-NODE-01",
  "sample_rate_hz": 125,
  "lead_name": "Lead-II",
  "sample_count": 125,
  "samples": [0.05, 0.12, 0.85, -0.22, 0.15],
  "start_time": "2026-11-06T15:30:00.000+06:00",
  "end_time": "2026-11-06T15:30:01.000+06:00",
  "created_at": "2026-11-06T15:30:01+06:00"
}
```

### Collection 3: `manual_blood_pressure`
```json
{
  "_id": { "$oid": "672b84f224a1b023f0a1c003" },
  "patient_id": "PT-8802",
  "systolic_bp": 120,
  "diastolic_bp": 80,
  "pulse_rate": 72,
  "measurement_timestamp": "2026-11-06T15:35:00+06:00",
  "notes": "Bedside manual observation.",
  "recorded_by": "Dr. S. Jenkins, MD",
  "data_source": "manual_entry",
  "is_valid": true,
  "created_at": "2026-11-06T15:35:00+06:00"
}
```

### Collection 4: `devices`
```json
{
  "_id": { "$oid": "672b800024a1b023f0a1c010" },
  "device_uid": "ESP32-NODE-01",
  "device_name": "Wearable Node (ESP32-NODE-01)",
  "assigned_patient_id": "PT-8802",
  "mac_address": "24:6F:28:B4:72:01",
  "status": "online",
  "battery_level": 95,
  "wifi_rssi": -62,
  "firmware_version": "1.2.0",
  "last_heartbeat": "2026-11-06T15:35:30+06:00",
  "created_at": "2026-11-06T10:00:00+06:00"
}
```

### Collection 5: `patients`
```json
{
  "_id": { "$oid": "672b800024a1b023f0a1c020" },
  "id": "PT-8802",
  "patient_code": "PT-8802",
  "full_name": "Robert Vance",
  "age": 58,
  "gender": "Male",
  "phone": "+880 1711-002233",
  "ward_origin": "ICU Step-Down",
  "room_bed": "Discharged Home",
  "assigned_device_uid": "ESP32-NODE-01",
  "risk_status": "Normal",
  "discharge_date": "2026-11-06",
  "medical_notes": "Discharged for observational telemetry.",
  "baseline_thresholds": {
    "hr_min": 55,
    "hr_max": 105,
    "spo2_min": 94
  },
  "created_at": "2026-11-06T10:00:00+06:00"
}
```

### Collection 6: `alerts`
```json
{
  "_id": { "$oid": "672b85f224a1b023f0a1c008" },
  "patient_id": "PT-8802",
  "device_uid": "ESP32-NODE-01",
  "alert_type": "tachycardia",
  "severity": "critical",
  "message": "High Heart Rate (Tachycardia): 128 BPM",
  "threshold": "Max 120 BPM",
  "actual": "128 BPM",
  "is_acknowledged": false,
  "acknowledged_at": null,
  "acknowledged_by": null,
  "created_at": "2026-11-06T15:32:00+06:00"
}
```

---

## 5. ECG Batch Upload Format & Supported Sample Size

* **Sampling Rate:** `125 Hz` (125 samples/second) from AD8232 ADC.
* **Batch Sizing Strategy:**
  * **Recommended:** **125 samples** (1.0 second of data) or **250 samples** (2.0 seconds of data).
  * **Supported Range:** **25 to 500 samples** per HTTP POST.
* **Bandwidth & Throughput:**
  * 125 float samples in JSON $\approx$ 800 bytes payload.
  * Over HTTPS at 1 POST/sec, total Wi-Fi throughput is $\approx 1.2 \text{ KB/s}$, easily within ESP32 SPI RAM and Wi-Fi capability.

---

## 6. Render Docker Deployment Configuration

The repository contains:
* **`Dockerfile`**: Builds `php:8.2-apache`, installs `pecl install mongodb`, enables extension, installs Composer, runs `composer install --no-dev`, enables Apache `rewrite headers`, configures `AllowOverride All`, and routes dynamic `$PORT`.
* **`render.yaml`**: Standard Render Blueprint configuring region, docker build, dynamic port binding, and `/api/v1/latest` health check.
