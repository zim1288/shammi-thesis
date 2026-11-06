# MQTT Integration & Broker Specification
### ESP32-Based Home Patient Monitoring System (Biomedical Research Prototype)

This document specifies the real-time MQTT message broker architecture, topics, and payloads used by the ESP32 hardware and web clients.

---

## 1. Overview & Dual-Mode Telemetry Architecture

The system supports two complementary communication channels:
1. **MQTT (Real-time Streaming):** Used by the ESP32 to publish high-speed waveform batches and periodic telemetry to an Eclipse Mosquitto or cloud EMQX broker. The web dashboard subscribes directly via **MQTT over WebSocket** (`wss://`).
2. **HTTP REST (Permanent Persistence):** ESP32 sends periodic telemetry and batches to PHP backend endpoints (`POST /api/v1/readings` and `POST /api/v1/ecg`) for permanent storage in MongoDB Atlas.

```text
+---------------+           MQTT Publish          +-------------------+
|  ESP32 Node   | -----------------------------> |   MQTT Broker     |
| (AD8232,      |                                 | (Mosquitto/EMQX)  |
|  MAX30102,    |           HTTP POST             +-------------------+
|  MLX90614)    | ----+                             |         |
+---------------+     |                             | WSS     | TCP
                      v                             v         v
              +---------------+            +------------+  +-------------------+
              |  PHP Backend  | <--------- | Web Client |  | Background Daemon |
              |  (Render/Host)| (REST Poll)| (Dashboard)|  | (Python Sim)      |
              +---------------+            +------------+  +-------------------+
                      |
                      v
              +---------------+
              | MongoDB Atlas |
              +---------------+
```

---

## 2. Topic Architecture & Payload Formats

### A. High-Speed ECG Waveform Batch
* **Topic:** `patient/device01/ecg`
* **QoS Level:** `0` (low-latency streaming)
* **Frequency:** 1 time per second (containing 125 samples)
* **Payload Structure:**
  ```json
  {
    "device_uid": "ESP32-NODE-01",
    "patient_id": "PT-8802",
    "sample_rate_hz": 125,
    "lead_name": "Lead-II",
    "samples": [-0.04, 0.01, 0.15, 0.98, -0.25, 0.22, 0.02, 0.05, 0.11],
    "timestamp": "2026-11-06T15:30:00Z"
  }
  ```

---

### B. Periodic Sensor Vitals
* **Topic:** `patient/device01/vitals`
* **QoS Level:** `1`
* **Frequency:** Every 2 to 3 seconds
* **Payload Structure:**
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
    "timestamp": "2026-11-06T15:30:00Z"
  }
  ```

---

### C. Device Online / Offline Heartbeat (LWT)
* **Topic:** `patient/device01/status`
* **QoS Level:** `1` (Retained)
* **MQTT Last Will and Testament (LWT):**
  * When connected, ESP32 publishes: `{"device_uid": "ESP32-NODE-01", "status": "online"}`
  * The broker is configured with an LWT payload: `{"device_uid": "ESP32-NODE-01", "status": "offline"}`
  * If the ESP32 loses power or Wi-Fi, the broker immediately broadcasts the offline message to all dashboard subscribers.

---

## 3. Public Broker & WebSocket Settings

For research evaluation and local testing:
* **Host:** `broker.emqx.io`
* **TCP Port (for ESP32):** `1883`
* **Secure WebSocket (WSS Port for Web HUD):** `8084`
* **WebSocket Path:** `/mqtt`
* **SSL/TLS:** Required for HTTPS hosting (`useSSL: true`).
