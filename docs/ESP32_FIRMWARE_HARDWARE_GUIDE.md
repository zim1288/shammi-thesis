# ESP32 Hardware & Firmware Integration Guide
### Biomedical Continuous Patient Telemetry HUD
**Designed for Hardware Developers, Embedded Engineers & Thesis Reviewers**

> [!WARNING]
> **⚠️ Educational Prototype — Not for Diagnosis**  
> *This device and firmware architecture is an academic research prototype for biomedical signal acquisition and thesis demonstration. It is not an FDA/CE-certified diagnostic medical instrument.*

---

## 1. System Architecture & End-to-End Data Pipeline

To ensure the hardware connects seamlessly to the web application, here is how the data flows from the physical human subject to the clinician's screen:

```
[ Patient Body ]
       │
       ├── AD8232 (Lead-II Electrodes: RA, LA, RL)  ──> Analog Voltage (0 - 3.3V)
       │                                                 ├── ADC1 Channel (GPIO 34 / 35 / 36)
       │                                                 └── LO+ / LO- (GPIO 18 / 19)
       │
       └── MAX30102 (Optical PPG Finger Clip)       ──> Digital I2C Bus (SDA: 21, SCL: 22)
                                                         └── Red / IR Photodiode Pulses
                                                                   │
                                                                   ▼
                                                     [ ESP32 Microcontroller ]
                                                     - Dual-Core Xtensa 240 MHz
                                                     - FreeRTOS Task Scheduling
                                                     - Wi-Fi 802.11 b/g/n (2.4 GHz)
                                                                   │
                                                                   │ HTTPS POST (TLS / JSON)
                                                                   ▼
                                                  [ Cloud / Local Server ]
                                                  https://shammi-thesis.onrender.com
                                                  (or http://192.168.x.x:8000 for local test)
                                                                   │
                                                                   ▼
                                                  [ PHP 8.2 OOP Backend Engine ]
                                                  - Bearer Token Gatekeeper
                                                  - Clinical Range / Alert Evaluator
                                                  - Hybrid Storage (MongoDB Atlas + Fallback)
                                                                   │
                                                                   ▼
                                                  [ Doctor Telemetry HUD (Frontend) ]
                                                  - Live Canvas 60 FPS ECG Oscilloscope
                                                  - Real-Time Vitals Cards (HR, SpO2, Temp)
                                                  - Automatic Bed Decongestion Roster
```

---

## 2. Hardware Wiring & Pinout Reference

### A. AD8232 Single-Lead ECG Sensor
| AD8232 Pin | ESP32 Pin | Type | Critical Engineering Requirement |
| :--- | :--- | :--- | :--- |
| **3.3V** | **3V3** | Power | Connect to **3.3V**, NOT 5V! |
| **GND** | **GND** | Ground | Common system ground. |
| **OUTPUT** | **GPIO 34 (or 35 / 36)** | Analog Input | ⚠️ **MANDATORY ADC1:** Never use ADC2 pins (0, 2, 4, 12–15, 25–27) because ADC2 is disabled by ESP32 Wi-Fi! |
| **LO+** | **GPIO 18** | Digital Input | Leads-off detection pin + (High = electrode detached). |
| **LO-** | **GPIO 19** | Digital Input | Leads-off detection pin - (High = electrode detached). |
| **SDN** | *Unconnected* | Control | Shutdown pin (Leave floating or pull to 3.3V for active). |

### B. MAX30102 Pulse Oximeter & Heart Rate Sensor
| MAX30102 Pin | ESP32 Pin | Type | Notes |
| :--- | :--- | :--- | :--- |
| **VIN** | **3V3** | Power | Ensure clean 3.3V rail. |
| **GND** | **GND** | Ground | Common system ground. |
| **SDA** | **GPIO 21** | I2C Data | Default ESP32 hardware I2C SDA. |
| **SCL** | **GPIO 22** | I2C Clock | Default ESP32 hardware I2C SCL. |
| **INT** | *Optional* | Interrupt | Optional hardware sample-ready interrupt. |

### C. Optional DS18B20 or MLX90614 Temperature Sensor
| Sensor Pin | ESP32 Pin | Type | Notes |
| :--- | :--- | :--- | :--- |
| **VCC** | **3V3** | Power | 3.3V logic. |
| **GND** | **GND** | Ground | Common ground. |
| **DATA** | **GPIO 4** | 1-Wire / I2C | 4.7kΩ pull-up resistor to 3.3V for DS18B20. |

---

## 3. Pre-Registered Dashboard Patients & Device IDs

When your firmware sends sensor data, the backend matches the `device_uid` and `patient_id` with the active hospital roster. **Hardcode one of these pairs into your firmware:**

| Device UID | Assigned Patient ID | Patient Full Name | Ward & Room Bed | Baseline Thresholds |
| :--- | :--- | :--- | :--- | :--- |
| **`ESP32-NODE-01`** | **`PT-8802`** | **Robert Vance** | Bed 04 / Room 402 (ICU Step-Down) | HR: 55–105, SpO2: ≥94%, Temp: ≤37.8°C |
| **`ESP32-NODE-02`** | **`PT-4091`** | **Nasreen Akter** | Bed 12 / Post-Op (Post-Operative Ward) | HR: 60–110, SpO2: ≥95%, Temp: ≤38.0°C |
| **`ESP32-NODE-03`** | **`PT-7124`** | **Anisur Rahman** | Bed 02 / Emergency (Observation Ward) | HR: 55–100, SpO2: ≥94%, Temp: ≤37.5°C |
| **`ESP32-NODE-04`** | **`PT-5518`** | **Tahmina Begum** | Bed 09 / Cardiology (Cardio Step-Down) | HR: 50–115, SpO2: ≥92%, Temp: ≤38.2°C |
| **`ESP32-NODE-05`** | **`PT-3305`** | **Kamal Hossain** | Bed 15 / General Surgery (Recovery) | HR: 60–100, SpO2: ≥95%, Temp: ≤37.6°C |
| **`ESP32-NODE-06`** | **`PT-4371`** | **Begum Rokeya** | Discharged Home (Step-Down Remote) | HR: 55–100, SpO2: ≥95%, Temp: ≤37.5°C |

> [!TIP]
> **Recommended for initial testing:** Use `device_uid: "ESP32-NODE-01"` and `patient_id: "PT-8802"`. This is the primary spotlight patient displayed on the Central Telemetry HUD.

---

## 4. REST API Ingestion Contract

### Base URLs
* **Production Cloud:** `https://shammi-thesis.onrender.com`
* **Local Development:** `http://<YOUR_PC_IP>:8000`

### Authentication Header
Every HTTP POST from the ESP32 **must** include this header:
```http
Authorization: Bearer esp32_research_secret_token_2026
```
*(The backend also accepts `Bearer esp32_clinical_token_2026` for backward compatibility).*

---

### Endpoint 1: Periodic Vitals Ingestion
* **Route:** `POST /api/v1/readings` (or `/api/ingest/vitals.php`)
* **Transmission Interval:** Send every **2 to 3 seconds**.
* **Content-Type:** `application/json`

#### Request JSON Body
```json
{
  "device_uid": "ESP32-NODE-01",
  "patient_id": "PT-8802",
  "heart_rate": 76,
  "spo2": 98.4,
  "temperature": 36.8,
  "ecg_lead_status": "normal",
  "ppg_finger_detected": 1,
  "battery_level": 92,
  "wifi_rssi": -64
}
```

#### Field Explanations
| Field Name | Type | Allowed Values | Explanation |
| :--- | :--- | :--- | :--- |
| `device_uid` | String | e.g. `"ESP32-NODE-01"` | Hardware identifier. |
| `patient_id` | String | e.g. `"PT-8802"` | Patient to whom data is attached. |
| `heart_rate` | Integer | `30` – `220` (or `null`) | Heart rate in BPM from PPG or ECG. |
| `spo2` | Float | `70.0` – `100.0` (or `null`) | Oxygen saturation percentage. |
| `temperature` | Float | `30.0` – `44.0` (or `null`) | Core or skin temperature in °C. |
| `ecg_lead_status`| String | `"normal"` or `"leads_off"` | Checked via AD8232 LO+/LO- pins. |
| `ppg_finger_detected` | Int | `1` (yes) or `0` (no) | Optical proximity flag from MAX30102. |
| `battery_level` | Integer | `0` – `100` | Li-Ion battery percentage via voltage divider. |
| `wifi_rssi` | Integer | `-100` to `0` | Wi-Fi signal strength in dBm (`WiFi.RSSI()`). |

#### Expected Response (`201 Created`)
```json
{
  "success": true,
  "ok": true,
  "message": "Vitals telemetry recorded successfully",
  "timestamp": "2026-11-06T20:10:00+06:00",
  "data": {
    "reading_id": "READ-6aed9f...",
    "patient_id": "PT-8802",
    "device_status": "online",
    "alerts_checked": 0
  }
}
```

---

### Endpoint 2: High-Speed ECG Batch Ingestion
* **Route:** `POST /api/v1/ecg` (or `/api/ingest/ecg_batch.php`)
* **Transmission Interval:** Send every **1 to 2 seconds**.
* **Sampling Rate:** 125 Hz or 250 Hz (1 sample every 4 ms).
* **Batch Size:** 250 to 500 samples per upload.
* **Payload Size:** ~2 to 4 KB.

#### Request JSON Body
```json
{
  "device_uid": "ESP32-NODE-01",
  "patient_id": "PT-8802",
  "sample_rate_hz": 250,
  "samples": [512, 518, 532, 560, 620, 780, 520, 490, 505, 512],
  "lead_status": "normal"
}
```
*(Both `"samples"` and `"raw_samples"` keys are supported by the backend).*

#### Expected Response (`201 Created`)
```json
{
  "success": true,
  "ok": true,
  "message": "ECG batch ingested successfully",
  "timestamp": "2026-11-06T20:10:00+06:00",
  "data": {
    "batch_id": "ECG-6aed...",
    "sample_count": 10,
    "rate_hz": 250
  }
}
```

---

## 5. ESP32 Arduino C++ Best Practices & Traps

### 1. `WiFiClientSecure` SSL Handshake
When posting to Render (`https://shammi-thesis.onrender.com`), the ESP32 must use `WiFiClientSecure`. During prototyping, bypass CA certificate storage using:
```cpp
#include <WiFiClientSecure.h>
WiFiClientSecure client;
client.setInsecure(); // Essential for fast prototype HTTPS handshake
```

### 2. Render Cold-Start Timeout
Free-tier cloud servers spin down after 15 minutes of inactivity. The first HTTP request may take up to **45 seconds** to wake the container:
```cpp
HTTPClient http;
http.setTimeout(45000); // 45s timeout to prevent premature abort
```

### 3. Memory Allocation (Avoid String Heap Fragmentation)
Do NOT use `String json = "{...}"` with multiple `+=` additions. That fragments the ESP32 heap.
Use **ArduinoJson v6 or v7**:
```cpp
StaticJsonDocument<1024> doc; // Or JsonDocument in v7
doc["device_uid"] = "ESP32-NODE-01";
doc["patient_id"] = "PT-8802";
doc["heart_rate"] = hr;
String output;
serializeJson(doc, output);
```

### 4. Non-Blocking Wi-Fi Reconnect
If the clinic Wi-Fi drops, your code must not freeze:
```cpp
if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Reconnecting Wi-Fi...");
    WiFi.reconnect();
}
```

---

## 6. Quick Verification with cURL (Before Uploading Firmware)

Before touching the hardware, you can test the cloud endpoint directly from your terminal:

```bash
curl -X POST "https://shammi-thesis.onrender.com/api/v1/readings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer esp32_research_secret_token_2026" \
  -d '{
    "device_uid": "ESP32-NODE-01",
    "patient_id": "PT-8802",
    "heart_rate": 74,
    "spo2": 98.5,
    "temperature": 36.8,
    "ecg_lead_status": "normal",
    "battery_level": 95,
    "wifi_rssi": -60
  }'
```

If you receive HTTP 201 `Vitals telemetry recorded successfully`, open `https://shammi-thesis.onrender.com/frontend/telemetry.html` and watch the vitals immediately update on Robert Vance's card!
