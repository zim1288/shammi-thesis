# ESP32-Based Continuous Patient Telemetry & Hospital Ward Decongestion System
### Biomedical Engineering & Telehealth Research Prototype

> [!WARNING]
> **⚠️ Educational Prototype — Not for Diagnosis**  
> *This system is an academic research and engineering prototype developed for biomedical signal acquisition, remote patient monitoring, and thesis evaluation. It is not a certified medical device and must not be used for primary clinical diagnosis, emergency medical monitoring, or life-critical interventions.*

---

## 1. System Overview & Architecture

This repository contains the production-ready full-stack software platform, REST telemetry ingestion pipeline, MQTT streaming bridge, and high-speed ECG oscilloscope visualization for an **ESP32-based multi-sensor patient monitoring system**.

The system is designed to facilitate safe, post-acute remote patient observation, helping hospitals decongest inpatient wards by monitoring recovering patients continuously from step-down beds or home environments.

```
                           +-------------------------------------+
                           |      ESP32 Biomedical Node          |
                           |  - AD8232 ECG Bio-Amplifier         |
                           |  - MAX30102 Pulse Oximeter (PPG)    |
                           |  - MLX90614 IR Surface Temp Sensor  |
                           +------------------+------------------+
                                              |
                   +--------------------------+--------------------------+
                   | (WiFi / HTTPS REST)                                 | (MQTT over TCP)
                   v                                                     v
       +-----------------------+                             +-----------------------+
       |   REST Ingestion API  |                             |   Public/Private MQTT |
       | /api/ingest/vitals.php|                             |   Broker (e.g. EMQX)  |
       +-----------+-----------+                             +-----------+-----------+
                   |                                                     |
                   v                                                     | (WebSocket wss://)
       +-----------------------+                                         |
       |  PHP 8.2 Backend OOP  |                                         |
       | - Ingestion Service   |                                         |
       | - Alert Engine        |                                         |
       | - CSRF & Auth Guard   |                                         |
       +-----------+-----------+                                         |
                   |                                                     |
                   v                                                     |
       +-----------------------+                                         |
       | Hybrid Persistence:   |                                         |
       | - MongoDB Atlas       |                                         |
       | - Atomic JSON Store   |                                         |
       |   (with LOCK_EX)      |                                         |
       +-----------+-----------+                                         |
                   |                                                     |
                   +--------------------------+--------------------------+
                                              |
                                              v
                              +-------------------------------+
                              |    Central Doctor Portal      |
                              | - Authentication-First Gate   |
                              | - Multi-Patient Directory     |
                              | - Real-time Oscilloscope HUD  |
                              | - Manual Clinical BP Logs     |
                              +-------------------------------+
```

### Key Technical Highlights
* **Authentication-First Workflow:** Unauthenticated visitors are automatically routed to the Login/Registration portal. All clinical views are protected by both server-side redirects and client-side session guards.
* **Dual Heart Rate Separation:** Displays independent readings for **ECG Heart Rate (AD8232 Lead-II bio-amplifier)** and **MAX30102 Optical Pulse Rate (PPG)** to prevent clinical sensor ambiguity.
* **OTP Verification Vault & Security Lifecycle:**
  * **30-Minute Expiration Window:** OTP passcodes strictly expire after 30 minutes.
  * **2-Minute (120s) Resend Cooldown:** Rate-limiting blocks rapid resend spam on both frontend and backend (HTTP 429).
  * **Active Session Reuse:** Navigating back within 30 minutes seamlessly reuses the active valid code.
  * **Immediate Superseding:** Requesting a new code automatically invalidates previous codes.
  * **Zero Passcode Leakage:** Passcodes are never exposed on screen or in HTML markup.
  * **Client-Side RFC Validation:** Incomplete emails (e.g. `user@gmail` missing `.com`) are caught before any network calls.
* **Patient Onboarding & IoT Hardware Pairing:** Attending physicians can easily admit/discharge recovering patients and pair wearable ESP32 telemetry hardware with custom clinical alarm baselines.
* **60 FPS Oscilloscope Sweep:** Hardware-accelerated HTML5 Canvas with continuous sweep line, blanking needle, and lead-off flatlining.
* **Dual-Mode Telemetry Stream:** Real-time MQTT over WebSocket (`wss://`) with automatic 2.5-second REST polling fallback.
* **Hybrid Cloud/Flat Storage:** Seamlessly operates with **MongoDB Atlas** or local MongoDB, with an automated fallback to atomic, thread-safe JSON document storage (`LOCK_EX`).
* **Multi-Platform Deployment:** Ready for zero-configuration 1-click deployment on **Render.com** (via Docker Blueprint) or direct upload to **cPanel shared hosting**.

---

## 2. Default Access Credentials

For thesis evaluators, academic supervisors, and testing:

| Role | Username / Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Attending Clinician** | `doctor@hospital.gov.bd` | `Doctor@2026!` | Central Dashboard, Dedicated HUD, Alerts, Manual Entry |
| **IoT Node Ingestion** | `Authorization: Bearer esp32_research_secret_token_2026` | N/A | Hardware Vitals & Waveform Batch Ingestion |

---

## 3. Project Directory Structure

```text
shammi thesis/
├── .dockerignore                     # Docker build exclusions
├── .gitignore                        # Git repository exclusions (secrets, brain, plans, private logs)
├── .htaccess                         # Apache / cPanel security headers, API rewrites & access denial
├── Dockerfile                        # Production PHP 8.2 + Apache container for Render.com
├── index.php                         # Root traffic router (enforces login-first -> frontend/)
├── router.php                        # Local development security router (blocks backend/data_store/ access)
├── render.yaml                       # Render.com Blueprint specification
├── README.md                         # Platform documentation & deployment guide
│
├── frontend/                         # Dedicated Frontend Client (UI, Dashboards & Visualizations)
│   ├── alerts.html                   # Physiological alarms & notification management
│   ├── auth.html                     # Sliding Doctor Login & Registration portal
│   ├── history.html                  # Biosignals telemetry table & CSV export
│   ├── index.html                    # Dedicated Live Telemetry HUD & Oscilloscope
│   ├── otp.html                      # 4-Digit OTP Passcode verification vault
│   ├── patients.html                 # Central Doctor Dashboard & Patient Directory
│   ├── assets/                       # Custom styles & controller scripts for Auth & OTP
│   │   ├── css/                      # Dedicated auth.css & otp.css
│   │   └── js/                       # Dedicated auth.js & otp.js
│   ├── css/                          # Core HUD stylesheet (styles.css)
│   └── js/                           # Modular Frontend Controllers
│       ├── auth_guard.js             # Client-side session gatekeeper & badge manager
│       ├── config.js                 # Frontend API endpoints & MQTT WebSocket settings
│       ├── dashboard.js              # Live telemetry coordinator & oscilloscope controller
│       ├── ecg_canvas.js             # High-performance 60fps HTML5 Canvas ECG renderer
│       ├── manual_bp_modal.js        # Decoupled Manual BP dialog & CSRF submission
│       └── patients.js               # Patient directory, filtering, & device intake form
│
├── backend/                          # Dedicated Backend Architecture (APIs, OOP Services & Data)
│   ├── api/                          # Thin REST Controllers (JSON API)
│   │   ├── alerts/                   # Alert listing & clinician acknowledgment
│   │   ├── auth/                     # Unified session & OTP lifecycle controllers
│   │   ├── blood_pressure/           # Segregated manual clinical observations
│   │   ├── devices/                  # ESP32 hardware status & LWT heartbeat
│   │   ├── ingest/                   # Hardware ingestion endpoints (Bearer token protected)
│   │   ├── patients/                 # Discharge onboarding & hardware pairing
│   │   └── vitals/                   # Dashboard telemetry aggregation & research CSV export
│   │
│   ├── config/                       # Central Configuration
│   │   ├── app.php                   # Timezone, CORS, security headers, session policies
│   │   ├── mongodb.php               # MongoDB connection parameters
│   │   └── thresholds.php            # Medical safety alarm thresholds
│   │
│   ├── data_store/                   # Flat-file database fallback (Atomic LOCK_EX)
│   │   ├── .htaccess                 # Denies all direct HTTP browser access to data files
│   │   ├── active_otps.json          # Active OTP sessions (auto-managed, ignored in git)
│   │   ├── alerts.json               # Physiological alarm history
│   │   ├── devices.json              # Registered ESP32 hardware nodes
│   │   ├── ecg_batches.json          # Buffered ECG waveform arrays
│   │   ├── manual_blood_pressure.json # Segregated manual clinician records
│   │   ├── patients.json             # Patient directory & baseline clinical profiles
│   │   ├── sensor_readings.json      # Continuous time-series sensor archive
│   │   └── users.json                # Hashed clinician accounts (bcrypt)
│   │
│   ├── database/                     # Database schemas & reference scripts
│   │   └── schema.sql                # Relational database schema reference
│   │
│   ├── mqtt_service/                 # Hardware Emulation Tools
│   │   └── esp32_simulator.py        # Python biosignal generator (ECG, PPG, Temp)
│   │
│   └── src/                          # Clean Layered OOP Architecture
│       ├── Core/                     # Foundational System Infrastructure
│       │   ├── MongoConnection.php   # Thread-safe Singleton MongoDB driver & JSON fallback
│       │   ├── Request.php           # HTTP request parser, XSS sanitizer & raw input extractor
│       │   ├── Response.php          # Standardized JSON response envelope (success + ok)
│       │   └── Security.php          # CSRF lifecycle manager & Bearer token gatekeeper
│       ├── Repositories/             # Data Access Layer
│       │   ├── AlertRepository.php
│       │   ├── BloodPressureRepository.php
│       │   ├── DeviceRepository.php
│       │   ├── EcgBatchRepository.php
│       │   ├── OtpRepository.php
│       │   ├── PatientRepository.php
│       │   ├── UserRepository.php
│       │   └── VitalsRepository.php
│       └── Services/                 # Business Logic Layer
│           ├── AlertEngineService.php # Automated physiological safety evaluation engine
│           ├── IngestionService.php  # Telemetry & waveform ingestion pipeline
│           └── TelemetryService.php  # Real-time dashboard data aggregator
│
└── docs/                             # In-Depth Guides (cPanel, MongoDB, MQTT, APIs)
```

---

## 4. Patient Onboarding & IoT Device Pairing Guide

To admit a patient for remote post-acute care and pair an ESP32 wearable node:

1. **Access the Central Doctor Dashboard:**  
   Navigate to `frontend/patients.html` after logging in.
2. **Open the Onboarding Modal:**  
   Click the **`+ Add Patient & Device`** button in the top navigation bar or directly above the patient roster table.
3. **Fill Patient Demographics:**  
   Enter the patient's Full Name, Age, Gender, Primary Phone, Ward of Origin, and relevant clinical discharge notes.
4. **Assign IoT Telemetry Hardware:**  
   Assign an ESP32 Device UID (e.g., `ESP32-NODE-05`) and optional hardware MAC address.
5. **Set Baseline Safety Thresholds:**  
   Configure custom Min/Max Heart Rate (BPM) and Minimum SpO₂ (%) thresholds tailored to the patient's clinical baseline.
6. **Save & Monitor:**  
   Click **`Provision Device & Save Patient`**. The system registers the patient in the database, associates the node, and offers one-click navigation to their Dedicated Live Telemetry HUD.

---

## 5. Quick Start (Local Development)

### Prerequisites
* PHP 8.2 or higher
* Python 3.8+ (optional, for running the hardware simulator)

### Steps
1. **Start the local server with security router:**
   Open a terminal in the project root directory:
   ```bash
   php -S localhost:8000 router.php
   ```
   *The `router.php` script enforces strict HTTP 403 Forbidden protection on `/data_store/`, blocking unauthorized direct browser access to internal JSON flat files while serving APIs and public assets seamlessly.*

2. **Open the application:**
   Navigate to:
   ```
   http://localhost:8000/
   ```
   * Unauthenticated visitors are automatically routed to `frontend/auth.html`.
   * Log in using `doctor@hospital.gov.bd` / `Doctor@2026!`.
   * Upon successful login, you are redirected to the Central Patient Directory (`frontend/patients.html`).

3. **Run the ESP32 Hardware Simulator (Optional):**
   In a second terminal window, run:
   ```bash
   python backend/mqtt_service/esp32_simulator.py
   ```
   The simulator continuously streams realistic 125 SPS ECG Lead-II waveforms, pulse rates, SpO₂, and body temperatures to the ingestion API.

---

## 6. Deployment Options

### Option A: Render.com (Recommended Cloud Deployment)
The repository includes a ready-to-deploy [`render.yaml`](file:///e:/New%20folder%20(4)/Shammi/shammi%20thesis/render.yaml) Blueprint and a production [`Dockerfile`](file:///e:/New%20folder%20(4)/Shammi/shammi%20thesis/Dockerfile).

1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Production release: ESP32 Patient Monitoring System"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. Go to [dashboard.render.com](https://dashboard.render.com).
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Select your GitHub repository.
5. Render will automatically read `render.yaml`, build the lightweight PHP container, configure dynamic port routing, and deploy your live HTTPS web application.

### Option B: Traditional cPanel Shared Hosting
1. Compress the project contents into a `.zip` archive.
2. Log into your cPanel File Manager and open `public_html/`.
3. Upload and extract the archive directly into `public_html/`.
4. Ensure the `data_store/` directory has write permissions (`chmod 775`).
5. Open your domain in any browser: `https://yourdomain.com/`.

---

## 7. Hardware Ingestion API & Firmware Guide

> [!TIP]
> **Dedicated Embedded Firmware Guide & Ready-to-Flash Arduino Code:**
> * 📖 Full Wiring, Pinout, Patient Mapping & Troubleshooting: [`docs/ESP32_FIRMWARE_HARDWARE_GUIDE.md`](docs/ESP32_FIRMWARE_HARDWARE_GUIDE.md)
> * ⚡ Ready-to-Flash Arduino C++ Sketch (.ino): [`firmware/esp32_firmware/esp32_firmware.ino`](firmware/esp32_firmware/esp32_firmware.ino)


### Ingestion Authentication
All hardware requests from ESP32 nodes must include the Bearer token:
```http
Authorization: Bearer esp32_research_secret_token_2026
Content-Type: application/json
```

### 1. Ingest Periodic Sensor Vitals
`POST /api/ingest/vitals.php`

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

### 2. Ingest High-Speed ECG Waveform Batch
`POST /api/ingest/ecg_batch.php`

```json
{
  "device_uid": "ESP32-NODE-01",
  "patient_id": "PT-8802",
  "sample_rate_hz": 125,
  "lead_name": "Lead-II",
  "samples": [0.02, 0.05, 0.18, -0.14, 1.05, -0.30, 0.28, 0.01],
  "start_time": "2026-11-06T15:30:00+06:00",
  "end_time": "2026-11-06T15:30:01+06:00"
}
```

---

## 8. Security & Engineering Best Practices

* **CSRF Protection:** Centralized cryptographic anti-CSRF token lifecycle (`bin2hex(random_bytes(32))`) enforced via `Security::enforceCsrf($request)` on all state-changing clinical actions (`manual_entry.php`, `create.php`, `acknowledge.php`).
* **Direct File Download Prevention:**
  * In Apache / Docker / cPanel: Root `.htaccess` rejects direct requests to `^data_store/` and all `.json` files (`RewriteRule ^data_store(/.*)?$ - [F,L,NC]`).
  * In Local PHP CLI Server: `router.php` rejects direct HTTP calls targeting `/data_store/` with HTTP 403 Forbidden.
* **Atomic File Writes (`LOCK_EX`):** All flat-file persistence routines enforce exclusive file locking to prevent race conditions or file corruption under concurrent ESP32 telemetry streaming.
* **Separation of Concerns (OOP):** Controllers in `api/` are thin, routing business logic to `Services/` and data storage to dedicated `Repositories/` (`UserRepository`, `OtpRepository`, `PatientRepository`, etc.).
* **Sensitive Data Shielding (`.gitignore`):** Git configuration guarantees zero commits of AI transcripts, brain logs, active OTP stores, `.env` files, or test keys.
* **Output Entity Encoding (Anti-XSS):** All dynamic strings (patient names, clinical notes, attending doctor badges) are encoded via `escapeHtml()` prior to DOM injection.
* **Modern Security Headers:** Responses automatically send `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 9. License & Academic Disclaimer

Developed for biomedical engineering research and academic thesis presentation.  
Copyright © 2026 Dhaka Regional Clinical Network Research Group. All rights reserved.
