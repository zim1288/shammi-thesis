# MongoDB Atlas Cloud Database Setup Guide
### ESP32-Based Home Patient Monitoring System (Biomedical Research Prototype)

This guide walks through configuring a free **MongoDB Atlas (M0 Free Tier)** cloud database for real-time patient telemetry storage.

---

## 1. Why MongoDB Atlas for this Project?
* **100% Free Tier (M0 Cluster):** 512 MB cloud storage with zero credit card required.
* **Native JSON Document Store:** Biosignal telemetry, sensor readings, and 125 SPS ECG sample arrays are stored natively without schema migration overhead.
* **cPanel & Render Compatible:** Both Render.com and cPanel hosts connect via outbound TLS (`mongodb+srv://...`).

---

## 2. Step-by-Step Atlas Setup (Takes ~3 minutes)

### Step 1: Create Free Cluster
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and create a free account.
2. Click **Create Deployment** $\rightarrow$ select **M0 (Free)**.
3. Choose the cloud provider and region closest to your server (e.g., AWS or GCP in Singapore or Frankfurt).
4. Click **Create Cluster**.

---

### Step 2: Configure Database User & Network Access
1. **Security $\rightarrow$ Database Access:**
   * Click **Add New Database User**.
   * Authentication Method: **Password**.
   * Enter a username (e.g. `patient_admin`) and a secure password.
   * Built-in Role: **Read and write to any database**.
   * Click **Add User**.
2. **Security $\rightarrow$ Network Access:**
   * Click **Add IP Address**.
   * Select **Allow Access From Anywhere** (`0.0.0.0/0`) so your Render cloud instance or cPanel web host can connect.
   * Click **Confirm**.

---

### Step 3: Copy Connection String to Your Project
1. Under **Database**, click the **Connect** button on your cluster card.
2. Select **Drivers** $\rightarrow$ Driver: **PHP**.
3. Copy your connection string. It will follow this structure:
   ```text
   mongodb+srv://<db_username>:<db_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Open `backend/config/mongodb.php` in your code editor and update the constant:
   ```php
   define('MONGO_URI', getenv('MONGO_URI') ?: 'mongodb+srv://<db_username>:<db_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority');
   define('MONGO_DB_NAME', getenv('MONGO_DB_NAME') ?: 'patient_monitor');
   ```
   *(Alternatively, on Render.com, add `MONGO_URI` in your Environment Variables dashboard; `backend/config/mongodb.php` automatically prioritizes environment variables).*

---

## 3. Collections Structure & Document Formats

The database maintains 6 core collections:

| Collection Name | Purpose |
| :--- | :--- |
| **`patients`** | Patient demographics, discharge date, ward of origin, and customized clinical baseline alarm thresholds. |
| **`devices`** | ESP32 hardware registry, online/offline status, WiFi RSSI, battery level, and last heartbeat. |
| **`sensor_readings`** | Periodic low-frequency vitals (ECG Heart Rate, MAX30102 Pulse Rate, SpO₂, Surface Temperature). |
| **`ecg_batches`** | High-speed 125 SPS AD8232 Lead-II waveform chunks. |
| **`manual_blood_pressure`** | Segregated bedside clinical blood pressure measurements with clinician signatures. |
| **`alerts`** | Automated physiological alarm log (Tachycardia, Bradycardia, Hypoxemia, Electrode Lead-Off). |
