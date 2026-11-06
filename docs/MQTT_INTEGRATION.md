# MQTT Integration & Broker Specification
**ESP32-Based Home Patient Monitoring System (Educational Prototype)**

---

## 1. Overview & Architecture
The system supports two complementary communication channels:
1. **MQTT (Real-time Streaming):** Used by the ESP32 to publish high-speed waveform batches and periodic telemetry to an Eclipse Mosquitto broker (or compatible cloud broker like EMQX / HiveMQ). The web frontend subscribes directly via **MQTT over WebSocket** (`wss://`).
2. **HTTP REST (Archival Fallback):** ESP32 sends periodic telemetry and batches to PHP backend endpoints (`/api/ingest/vitals.php`) for permanent MySQL storage.

```
+---------------+           MQTT Publish          +-------------------+
|  ESP32 Node   | -----------------------------> |   MQTT Broker     |
| (AD8232,      |                                 | (Mosquitto/EMQX)  |
|  MAX30102,    |           HTTP POST             +-------------------+
|  MLX90614)    | ----+                             |         |
+---------------+     |                             | WSS     | TCP
                      v                             v         v
              +---------------+            +------------+  +-------------------+
              |  PHP Backend  | <--------- | Web Client |  | Background Daemon |
              |  (cPanel Host)|            | (Dashboard)|  | (Optional Worker) |
              +---------------+            +------------+  +-------------------+
                      |
                      v
              +---------------+
              | MySQL Database|
              +---------------+
```

---

## 2. Topic Architecture & Payload Formats

### A. High-Speed ECG Waveform Batch
* **Topic:** `patient/device01/ecg`
* **QoS Level:** `0` (or `1`)
* **Frequency:** 1 time per second (containing 125 samples)
* **Payload:**
```json
{
  "device_uid": "ESP32-NODE-01",
  "patient_id": 1,
  "sample_rate_hz": 125,
  "lead_name": "Lead-II",
  "samples": [-0.04, 0.01, 0.15, 0.98, -0.25, 0.22, 0.02, ...],
  "timestamp": "2026-11-02T17:30:00Z"
}
```

---

### B. Periodic Consolidated Telemetry
* **Topic:** `patient/device01/vitals`
* **QoS Level:** `1`
* **Frequency:** Every 2–5 seconds
* **Payload:**
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
  "timestamp": "2026-11-02T17:30:00Z"
}
```

---

### C. Device Online / Offline Status (LWT)
* **Topic:** `patient/device01/status`
* **QoS Level:** `1` (Retained = true)
* **Last Will and Testament (LWT) Payload (Set by ESP32 on connect):**
```json
{
  "device_uid": "ESP32-NODE-01",
  "status": "offline",
  "reason": "connection_lost_lwt",
  "timestamp": "2026-11-02T17:30:00Z"
}
```
* **Normal Online Payload (Sent upon Wi-Fi / MQTT connected):**
```json
{
  "device_uid": "ESP32-NODE-01",
  "status": "online",
  "firmware": "1.2.0",
  "ip_address": "192.168.1.145",
  "timestamp": "2026-11-02T17:30:00Z"
}
```

---

## 3. Broker Configuration (Eclipse Mosquitto)

If running your own Mosquitto server, ensure WebSockets are enabled in `mosquitto.conf`:

```conf
# Standard MQTT TCP port for ESP32
listener 1883
allow_anonymous true

# WebSocket listener for browser frontend dashboard
listener 9001
protocol websockets
allow_anonymous true
```

For SSL/TLS (HTTPS) deployment:
```conf
listener 8084
protocol websockets
certfile /etc/letsencrypt/live/yourdomain.com/fullchain.pem
keyfile /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

---

## 4. Security Rules
1. Never hardcode private broker administrator passwords in client-side HTML or JS files.
2. If using public brokers (e.g. `broker.emqx.io`), use unique topic prefixes to prevent cross-talk during educational research presentations.
