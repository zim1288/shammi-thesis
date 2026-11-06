# MongoDB Atlas Cloud Database Setup Guide
**ESP32-Based Home Patient Monitoring System (Educational Prototype)**

---

## 1. Why MongoDB Atlas for this Project?
* **100% Free Tier (M0 Cluster):** 512 MB storage with zero credit card required.
* **Native JSON Document Store:** Biosignal telemetry and high-frequency ECG sample arrays are stored natively without serialization overhead.
* **cPanel Friendly:** Shared cPanel hosts usually do not allow running local database daemons. With MongoDB Atlas, your PHP backend connects via a cloud URI (`mongodb+srv://...`) over outbound port 443/27017.

---

## 2. Step-by-Step Atlas Setup (Takes ~3 minutes)

### Step 1: Create Free Cluster
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and create a free account.
2. Click **Create Deployment** $\rightarrow$ select **M0 (Free)**.
3. Choose the cloud provider and region closest to your server (e.g. AWS / GCP in Singapore, Frankfurt, or N. Virginia).
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
   * Select **Allow Access From Anywhere** (`0.0.0.0/0`) so your cPanel web host and local development machine can connect.
   * Click **Confirm**.

---

### Step 3: Copy Connection String to Your Project
1. Under **Database**, click the **Connect** button on your cluster card.
2. Select **Drivers** $\rightarrow$ Driver: **PHP**.
3. Copy your connection string. It looks like:
   ```text
   mongodb+srv://patient_admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```
4. Open `config/mongodb.php` in your code editor and update the constant:
   ```php
   define('MONGO_URI', 'mongodb+srv://patient_admin:YOUR_PASSWORD_HERE@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority');
   define('MONGO_DB_NAME', 'patient_monitor');
   ```

---

## 3. Collections Structure & Document Formats

The database uses 6 core collections:

| Collection Name | Purpose |
| :--- | :--- |
| `patients` | Patient demographic details & assigned bed/room |
| `devices` | ESP32 hardware registry, online/offline status, WiFi signal, battery |
| `sensor_readings` | Periodic vitals (ECG Heart Rate, MAX30102 Pulse Rate, SpO2, Temperature) |
| `ecg_batches` | 125 Hz ECG waveform sample arrays (125 points/sec) |
| `manual_blood_pressure` | Segregated manual blood pressure readings (with audit trail) |
| `alerts` | Physiological alarms, lead detachments, and acknowledgment logs |

---

## 4. Intelligent Fallback (Zero-Downtime Guarantee)
If your MongoDB Atlas credentials have not been configured yet, or if internet connection to Atlas drops, the system’s `MongoConnection.php` automatically activates **JSON Document Storage Mode** (`data_store/*.json`). 

Your application will continue to run, accept vitals, render live waveforms, and store manual records without throwing fatal errors.
