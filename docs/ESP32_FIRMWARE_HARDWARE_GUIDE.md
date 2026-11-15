# ESP32 Hardware & Firmware Integration Guide
### Biomedical Continuous Patient Telemetry & Ward Decongestion HUD
**Authoritative Reference for IoT Engineers, Embedded Developers & Thesis Evaluators**

> [!WARNING]
> **⚠️ Educational Prototype — Not for Diagnosis**  
> *This device and firmware architecture is an academic research prototype developed for biomedical signal acquisition, remote patient observation, and thesis demonstration. It is not an FDA/CE-certified diagnostic medical instrument and must not be used for life-critical clinical interventions.*

---

## 1. System Architecture & End-to-End Data Pipeline

To ensure the hardware node connects seamlessly with the cloud backend and central clinician dashboard, here is the complete end-to-end data pipeline:

```
[ Patient Subject ]
       │
       ├── AD8232 (Lead-II Electrodes: RA, LA, RL) ──> Analog Output (0 - 3.3V)
       │                                                ├── ADC1 Channel (GPIO 34)
       │                                                └── LO+ / LO- (GPIO 18 / 19)
       │
       ├── MAX30102 (Optical PPG Finger Clip)      ──> I2C Bus (SDA: 21, SCL: 22, Addr: 0x57)
       │
       └── MLX90614 (Contactless IR Temperature)   ──> I2C Bus (SDA: 21, SCL: 22, Addr: 0x5A)
                                                                 │
                                                                 ▼
                                                  [ ESP32 Microcontroller Node ]
                                                  - Dual-Core Xtensa 32-bit LX6 @ 240 MHz
                                                  - Core 1: 125 Hz Sampling, OLED & Alarms
                                                  - Core 0: FreeRTOS Asynchronous HTTPS Task
                                                  - On-Device: SSD1306 OLED, LEDs & Buzzer
                                                                 │
                                                                 │ HTTPS POST (TLS / JSON)
                                                                 │ Bearer: shammi_thesis_2026
                                                                 ▼
                                                  [ Cloud Backend (Render PaaS) ]
                                                  https://shammi-thesis.onrender.com
                                                  - PHP 8.2 OOP Ingestion Engine
                                                  - Bearer Token & Device-UID Resolver
                                                  - Clinical Range / Alert Evaluator
                                                  - Hybrid Storage (MongoDB Atlas + Fallback)
                                                                 │
                                                                 ▼
                                                  [ Central Doctor Telemetry HUD ]
                                                  - Real-Time Vitals Cards (HR, SpO2, Temp)
                                                  - 60 FPS HTML5 Canvas ECG Oscilloscope
                                                  - Multi-Patient Bed Decongestion Roster
```

---

## 2. Complete Hardware Wiring & Pinout Reference

All sensors, indicators, and actuators are connected according to the following hardware pinout map:

### Master Pinout Table

| Peripheral / Sensor | Component Pin | ESP32 GPIO | Pin Mode | Engineering Notes |
| :--- | :--- | :--- | :--- | :--- |
| **AD8232 ECG** | `OUTPUT` | **GPIO 34** | `ANALOG INPUT` | ⚠️ **ADC1 ONLY:** Never use ADC2 pins because Wi-Fi disables ADC2! |
| | `LO+` | **GPIO 18** | `DIGITAL INPUT` | Leads-Off Detection + (HIGH = Electrode detached) |
| | `LO-` | **GPIO 19** | `DIGITAL INPUT` | Leads-Off Detection - (HIGH = Electrode detached) |
| | `3.3V` | `3V3` | Power Rail | **Must connect to 3.3V**, NOT 5V! |
| | `GND` | `GND` | Ground | Common system ground |
| **MAX30102 PPG** | `SDA` | **GPIO 21** | `I2C DATA` | Hardware I2C data (Address: `0x57`) |
| | `SCL` | **GPIO 22** | `I2C CLOCK` | Hardware I2C clock |
| | `VIN` | `3V3` | Power Rail | Clean 3.3V power |
| | `GND` | `GND` | Ground | Common system ground |
| **MLX90614 IR Temp** | `SDA` | **GPIO 21** | `I2C DATA` | Shares hardware I2C bus (Address: `0x5A`) |
| | `SCL` | **GPIO 22** | `I2C CLOCK` | Shares hardware I2C bus |
| | `VIN` | `3V3` | Power Rail | 3.3V power rail |
| | `GND` | `GND` | Ground | Common system ground |
| **SSD1306 OLED (128x64)** | `SDA` | **GPIO 21** | `I2C DATA` | Shares hardware I2C bus (Address: `0x3C`) |
| | `SCL` | **GPIO 22** | `I2C CLOCK` | Shares hardware I2C bus |
| | `VCC` | `3V3` | Power Rail | 3.3V power rail |
| | `GND` | `GND` | Ground | Common system ground |
| **Traffic Light Module** | `RED` | **GPIO 27** | `DIGITAL OUTPUT` | Active HIGH for Emergency / Critical Alert |
| | `YELLOW` | **GPIO 26** | `DIGITAL OUTPUT` | Active HIGH for Warning / Marginal Vitals |
| | `GREEN` | **GPIO 25** | `DIGITAL OUTPUT` | Active HIGH for Normal Patient Status |
| | `GND` | `GND` | Ground | Common system ground |
| **Audible Alarm Buzzer** | `SIG / +` | **GPIO 23** | `DIGITAL OUTPUT` | Drive via 2N2222 NPN transistor or buzzer module |
| | `GND` | `GND` | Ground | Common system ground |
| **Alarm Mute Button** | `PIN 1` | **GPIO 4** | `INPUT_PULLUP` | Press to mute local buzzer (pulls GPIO 4 to GND) |
| | `PIN 2` | `GND` | Ground | Common system ground |
| **Wi-Fi Status LED** | Onboard | **GPIO 2** | `DIGITAL OUTPUT` | Blinks during connection; solid ON when connected |

> [!IMPORTANT]
> **Shared I2C Bus Architecture:** The `MAX30102`, `MLX90614`, and `SSD1306 OLED` all share the exact same I2C lines (`SDA: GPIO 21`, `SCL: GPIO 22`). They do not conflict because they operate on unique I2C 7-bit addresses:
> * SSD1306 OLED: `0x3C`
> * MAX30102 PPG: `0x57`
> * MLX90614 IR: `0x5A`

---

## 3. Required Arduino IDE Libraries

Install the following official libraries using the **Arduino IDE Library Manager** (`Sketch ➔ Include Library ➔ Manage Libraries...`):

1. **`ArduinoJson`** (by *Benoit Blanchon*) — Version `6.x` or `7.x`
2. **`SparkFun MAX3010x Pulse and Proximity Sensor Library`** (by *SparkFun Electronics*)
3. **`Adafruit MLX90614 Library`** (by *Adafruit*)
4. **`Adafruit GFX Library`** (by *Adafruit*)
5. **`Adafruit SSD1306`** (by *Adafruit*)
6. **`Adafruit BusIO`** (automatically prompted by Adafruit libraries)

### Recommended Board Settings
* **Board:** `ESP32 Dev Module` or `DOIT ESP32 DEVKIT V1`
* **Upload Speed:** `921600` (or `115200` for basic cables)
* **Flash Frequency:** `80MHz`
* **CPU Frequency:** `240MHz (WiFi/BT)`
* **Serial Baud Rate:** `115200 baud`

---

## 4. Firmware Architecture: Dual-Core FreeRTOS Multitasking

To prevent slow cloud HTTPS network requests from freezing real-time medical sensor sampling or delaying emergency alarms, the firmware is architected into two separate FreeRTOS execution threads:

```
+-------------------------------------------------------------------------+
|                              ESP32 DUAL CORE                            |
|                                                                         |
|  [ CORE 1 - Real-Time Sensor Engine ]                                   |
|   - 125 Hz Analog ECG sampling (every 8 ms) via AD8232                  |
|   - MAX30102 PPG Optical pulse calculation                             |
|   - MLX90614 IR Surface temperature read                                |
|   - Local bedside Alert State Machine (Green/Yellow/Red traffic lights) |
|   - Bedside SSD1306 OLED frame rendering (1 FPS)                        |
|   - Mute button debouncing                                              |
|                                                                         |
|                     │ xQueueSend (Non-blocking)                         |
|                     ▼                                                   |
|       [ Thread-Safe FreeRTOS FIFO Queues ]                              |
|       - vitalsQueue (capacity: 4 packets)                               |
|       - ecgQueue    (capacity: 3 batches)                               |
|                     │                                                   |
|                     │ xQueueReceive                                     |
|                     ▼                                                   |
|  [ CORE 0 - Asynchronous Network Daemon (networkTaskLoop) ]             |
|   - Wi-Fi connection supervisor & auto-reconnect                        |
|   - HTTPS POST serialization via WiFiClientSecure (setInsecure())       |
|   - Dispatches vitals telemetry every 2.5 seconds                       |
|   - Dispatches 125-sample ECG batches every 1.0 second                  |
+-------------------------------------------------------------------------+
```

---

## 5. Device-to-Patient Pairing (Method A vs. Method B)

The backend provides two methods for mapping incoming IoT data to hospital patients:

### Method A: Dynamic Auto-Resolution by Device UID (Recommended)
* **Firmware Configuration:**
  ```cpp
  #define DEVICE_UID "ESP32-NODE-02"
  #define PATIENT_ID ""   // Leave EMPTY string!
  ```
* **How It Works:** When the node uploads data, the backend looks up `DEVICE_UID` in the database and automatically binds the readings to whichever patient is currently assigned to this device in the hospital dashboard.
* **Benefit:** When a patient is discharged and a new patient is admitted to that bed, the IoT engineer does **not** need to reflash the firmware. Reassignment is handled dynamically in the web portal!

### Method B: Static Patient Binding
* **Firmware Configuration:**
  ```cpp
  #define DEVICE_UID "ESP32-NODE-01"
  #define PATIENT_ID "PT-8802"
  ```
* **How It Works:** The backend assigns the telemetry directly to patient `PT-8802`. Useful for dedicated fixed research subjects.

---

## 6. Cloud Ingestion API Specifications

### Live Production Endpoints
* **Base Cloud URL:** `https://shammi-thesis.onrender.com`
* **Local Development URL:** `http://<YOUR_PC_IP>:8000`
* **Authentication Header:**
  ```http
  Authorization: Bearer shammi_thesis_2026
  Content-Type: application/json
  ```

---

### Endpoint 1: Periodic Vitals Ingestion
* **Route:** `POST /api/v1/readings` *(or `/api/ingest/vitals.php`)*
* **Interval:** Every **2.5 seconds**

#### Request Payload (JSON)
```json
{
  "device_uid": "ESP32-NODE-02",
  "patient_id": "",
  "heart_rate": 74,
  "ecg_heart_rate": 74,
  "max30102_pulse_rate": 73,
  "spo2": 98.2,
  "temperature": 36.8,
  "ecg_lead_status": "normal",
  "ppg_finger_detected": 1,
  "battery_level": 95,
  "wifi_rssi": -62,
  "local_alert_level": "green",
  "local_alert_reason": "All Vitals Normal",
  "sensor_fault": false,
  "physiological_alert": false,
  "buzzer_muted": false,
  "max30102_sensor_ok": true,
  "mlx90614_sensor_ok": true
}
```

#### Field Specifications
| Key | Type | Description |
| :--- | :--- | :--- |
| `device_uid` | String | Physical hardware ID (e.g. `"ESP32-NODE-02"`). |
| `patient_id` | String | Target patient code or `""` for backend auto-resolution. |
| `heart_rate` | Integer | Primary heart rate in BPM. |
| `spo2` | Float | Oxygen saturation percentage (`70.0` to `100.0`). |
| `temperature` | Float | Skin / core temperature in °C. |
| `ecg_lead_status`| String | `"normal"` or `"leads_off"` (from AD8232 LO+/LO-). |
| `ppg_finger_detected` | Integer | `1` (finger detected) or `0` (finger removed). |
| `battery_level` | Integer | Li-Ion percentage (`0` to `100`). |
| `wifi_rssi` | Integer | Signal strength in dBm from `WiFi.RSSI()`. |
| `local_alert_level` | String | `"green"`, `"yellow"`, or `"red"`. |

#### Response (`201 Created`)
```json
{
  "success": true,
  "ok": true,
  "message": "Vitals telemetry recorded successfully",
  "data": {
    "reading_id": "672b83f124a1b023f0a1c001",
    "patient_id": "PT-8893",
    "device_status": "online",
    "alerts_checked": 0
  }
}
```

---

### Endpoint 2: High-Speed ECG Batch Ingestion
* **Route:** `POST /api/v1/ecg` *(or `/api/ingest/ecg_batch.php`)*
* **Interval:** Every **1.0 second** (buffer of 125 samples at 125 Hz)

#### Request Payload (JSON)
```json
{
  "device_uid": "ESP32-NODE-02",
  "patient_id": "",
  "sample_rate_hz": 125,
  "lead_status": "normal",
  "start_time": 104520,
  "end_time": 105520,
  "samples": [512, 518, 524, 538, 580, 720, 890, 610, 490, 505, 512]
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "ok": true,
  "message": "ECG batch ingested successfully",
  "data": {
    "batch_id": "ECG-6aed9f...",
    "patient_id": "PT-8893",
    "sample_count": 125,
    "rate_hz": 125
  }
}
```

---

## 7. Troubleshooting & Verification Guide

### 1. Device shows "Online" on Dashboard, but no readings appear
* **Cause 1:** Device is not assigned to an active patient. Open the web dashboard ➔ Go to **Patients** ➔ Verify that the patient has their **Device UID** set to match your firmware (e.g. `ESP32-NODE-02`).
* **Cause 2:** Authentication token mismatch. Ensure `#define API_BEARER_TOKEN "shammi_thesis_2026"` matches the Render cloud environment variable `API_INGEST_KEY`.

### 2. Render Cloud "Cold Start" Delay
* Render free-tier services spin down after 15 minutes of inactivity. The first connection from the ESP32 might take **35 to 45 seconds** while the Docker container boots up.
* **Firmware Mitigation:** Ensure `http.setTimeout(15000);` is used and Wi-Fi auto-reconnection handles retry without crashing.

### 3. AD8232 ECG Voltage Saturation / Flatline
* **Check Wiring:** Ensure AD8232 `OUTPUT` is wired to **GPIO 34** (ADC1).
* **Leads-Off Check:** When electrodes are not attached to the chest/arms, `LO+` (GPIO 18) or `LO-` (GPIO 19) will be pulled HIGH, causing the firmware to output a clean baseline of `512`.

### 4. Direct cURL Test (Terminal Verification)
Verify your cloud backend without the hardware by running this in terminal or PowerShell:

```bash
curl -X POST "https://shammi-thesis.onrender.com/api/v1/readings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer shammi_thesis_2026" \
  -d '{
    "device_uid": "ESP32-NODE-02",
    "patient_id": "",
    "heart_rate": 76,
    "spo2": 98.4,
    "temperature": 36.8,
    "ecg_lead_status": "normal",
    "ppg_finger_detected": 1,
    "battery_level": 94,
    "wifi_rssi": -60
  }'
```
*If this returns `HTTP 201 Created`, your cloud ingestion pipeline is 100% operational!*
