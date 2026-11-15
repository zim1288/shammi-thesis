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
* **Dynamic IoT Device Liveness (Online/Offline Status):**
  * Real-time 45-second heartbeat freshness window evaluated against hardware ingestion timestamps.
  * Live visual feedback in the Patient Directory: **Pulsing Green Dot & `ONLINE` Badge** when actively streaming; **Solid Red Dot & `OFFLINE` Badge** when disconnected or beyond heartbeat threshold.
* **Patient Deletion & Hardware Unpairing:**
  * One-click patient discharge with dedicated modal confirmation and CSRF security check.
  * Automatically unbinds and frees the assigned ESP32 node back to the available hardware pool and decrements decongested bed metrics.
* **Secure Clinician Credential Setup & Phishing Resistance:**
  * Password reset and initial credential creation operate on a dedicated clinical screen (`set_credentials.html`).
  * Utilizes secure browser `sessionStorage` instead of sensitive URL query parameters (`?email=...&token=...`), eliminating heuristic Safe Browsing false positives on public cloud hostnames.
* **OTP Verification Vault & Security Lifecycle:**
  * **30-Minute Expiration Window:** OTP passcodes strictly expire after 30 minutes.
  * **2-Minute (120s) Resend Cooldown:** Rate-limiting blocks rapid resend spam on both frontend and backend (HTTP 429).
  * **Active Session Reuse:** Navigating back within 30 minutes seamlessly reuses the active valid code.
  * **Immediate Superseding:** Requesting a new code automatically invalidates previous codes.
  * **Zero Passcode Leakage:** Passcodes are never exposed on screen or in HTML markup.
  * **Client-Side RFC Validation:** Incomplete emails (e.g. `user@gmail` missing `.com`) are caught before any network calls.
* **Modular Front-End Architecture:** Monolithic CSS and JS files refactored into focused, single-responsibility modules (`< 300` lines each) for maintainability and clean separation of concerns.
* **Patient Onboarding & IoT Hardware Pairing:** Attending physicians can easily admit/discharge recovering patients and pair wearable ESP32 telemetry hardware with custom clinical alarm baselines.
* **60 FPS Oscilloscope Sweep:** Hardware-accelerated HTML5 Canvas with continuous sweep line, blanking needle, and lead-off flatlining.
* **Dual-Mode Telemetry Stream:** Real-time MQTT over WebSocket (`wss://`) with automatic 2.5-second REST polling fallback.
* **Hybrid Cloud/Flat Storage:** Seamlessly operates with **MongoDB Atlas** or local MongoDB, with an automated fallback to atomic, thread-safe JSON document storage (`LOCK_EX`).
* **Multi-Platform Deployment:** Ready for zero-configuration 1-click deployment on **Render.com** (via Docker Blueprint) or direct upload to **cPanel shared hosting**.

---

## 2. Default Access Credentials

For thesis evaluators, academic supervisors, and testing:

| Role | Username / Identifier | Access Credentials | Access Scope |
| :--- | :--- | :--- | :--- |
| **Attending Clinician** | `doctor@hospital.gov.bd` | Configured via `INITIAL_DOCTOR_PASSWORD` or OTP registration | Central Dashboard, Dedicated HUD, Alerts, Manual Entry |
| **IoT Node Ingestion** | `Authorization: Bearer <TOKEN>` | Configured via Render `API_INGEST_KEY` | Hardware Vitals & Waveform Batch Ingestion |

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
│   ├── set_credentials.html          # Registration-styled credential setup & password reset
│   │
│   ├── assets/                       # Custom styles & controller scripts for Auth & OTP
│   │   ├── css/                      # Master auth.css & otp.css
│   │   │   └── modules/              # Modular Auth Subsystems (< 300 lines each)
│   │   │       ├── auth_base.css     # Dark ambient canvas, backdrop light, reset & layout
│   │   │       ├── auth_forms.css    # Sliding dual panels, clinical inputs & toggle buttons
│   │   │       ├── password_meter.css # 5-criterion live strength meter & animated bar
│   │   │       └── otp_modal.css     # OTP digit vault, spinning orbit ring & celebratory confetti
│   │   └── js/                       # Dedicated auth.js, otp.js, & set_credentials.js
│   │
│   ├── css/                          # Core HUD stylesheet (styles.css entry point)
│   │   └── modules/                  # Modular Application Subsystems
│   │       ├── variables.css         # Clinical color palette, typography & glassmorphism
│   │       ├── header.css            # Top command bar, breadcrumbs, doctor badge & nav
│   │       ├── telemetry.css         # Live 5-grid vitals, canvas scope HUD & alarm strips
│   │       └── dashboard.css         # Patient cards, table layout, modals & online/offline dots
│   │
│   └── js/                           # Modular Frontend Controllers
│       ├── modules/                  # Domain-Specific UI & Service Modules
│       │   ├── patient_api.js        # API service (roster fetch, patient create & delete)
│       │   └── patient_ui.js         # Card & table row rendering with liveness indicators
│       ├── auth_guard.js             # Client-side session gatekeeper & badge manager
│       ├── config.js                 # Frontend API endpoints & MQTT WebSocket settings
│       ├── dashboard.js              # Live telemetry coordinator & oscilloscope controller
│       ├── ecg_canvas.js             # High-performance 60fps HTML5 Canvas ECG renderer
│       ├── manual_bp_modal.js        # Decoupled Manual BP dialog & CSRF submission
│       └── patients.js               # Clean controller orchestrator for patient management
│
├── backend/                          # Dedicated Backend Architecture (APIs, OOP Services & Data)
│   ├── api/                          # Thin REST Controllers (JSON API)
│   │   ├── alerts/                   # Alert listing & clinician acknowledgment
│   │   ├── auth/                     # Unified session & OTP lifecycle controllers
│   │   ├── blood_pressure/           # Segregated manual clinical observations
│   │   ├── devices/                  # ESP32 hardware status & LWT heartbeat
│   │   ├── ingest/                   # Hardware ingestion endpoints (Bearer token protected)
│   │   ├── patients/                 # Discharge onboarding, hardware pairing, & deletion (delete.php)
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

### 4.1 Patient Discharge & Node Unpairing Workflow
When a patient completes remote monitoring or is discharged:
1. Locate the patient in either the Card Grid or Table View on `frontend/patients.html`.
2. Click the red **Trash Can icon (`<i class="ri-delete-bin-line"></i>`)** in the upper-right corner of their patient card or table row.
3. A confirmation modal appears, summarizing the patient's ID, name, and paired IoT Device UID.
4. Click **`Confirm Discharge & Delete`**. The system securely dispatches a CSRF-protected request to `POST /api/patients/delete.php`:
   * Deletes the patient profile from MongoDB Atlas / JSON store.
   * Automatically unassigns the ESP32 node and returns its status to `unassigned`, freeing it for future patient intake.
   * Decrements active patient counts and dynamically updates decongested bed metrics across the portal.

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
All hardware requests from ESP32 nodes must include the Bearer token configured in your Render environment (`API_INGEST_KEY`):
```http
Authorization: Bearer shammi_thesis_2026
Content-Type: application/json
```

### 1. Ingest Periodic Sensor Vitals
`POST /api/v1/readings` *(or `/api/ingest/vitals.php`)*

> **Dynamic Auto-Resolution (Method A):** Leave `"patient_id": ""` blank so the backend automatically pairs the telemetry with whichever patient is assigned to `"device_uid": "ESP32-NODE-02"` in the database.

```json
{
  "device_uid": "ESP32-NODE-02",
  "patient_id": "",
  "heart_rate": 74,
  "ecg_heart_rate": 74,
  "max30102_pulse_rate": 73,
  "spo2": 98.4,
  "temperature": 36.6,
  "ir_temperature": 36.6,
  "ecg_lead_status": "normal",
  "ppg_finger_detected": 1,
  "battery_level": 94,
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

### 2. Ingest High-Speed ECG Waveform Batch
`POST /api/v1/ecg` *(or `/api/ingest/ecg_batch.php`)*

```json
{
  "device_uid": "ESP32-NODE-02",
  "patient_id": "",
  "sample_rate_hz": 125,
  "lead_name": "Lead-II",
  "samples": [512, 518, 524, 538, 580, 720, 890, 610, 490, 505, 512],
  "start_time": "2026-11-13T02:30:00+06:00",
  "end_time": "2026-11-13T02:30:01+06:00"
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
