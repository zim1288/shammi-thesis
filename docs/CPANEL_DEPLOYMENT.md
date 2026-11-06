# Deployment Instructions for cPanel Hosting
**ESP32 Home Patient Monitoring System (Educational Prototype)**

---

## 1. Prerequisites
- Access to cPanel dashboard (e.g. `https://yourdomain.com:2083`).
- PHP 7.4, 8.0, 8.1, or 8.2 with `pdo_mysql`, `json`, and `session` extensions enabled (default on all cPanel hosts).
- MySQL 5.7+ or MariaDB 10.3+.

---

## 2. Step-by-Step Deployment Procedure

### Step 1: Create the MySQL Database & User
1. Log in to your **cPanel**.
2. Under the **Databases** section, click **MySQL® Databases**.
3. Create a new database:
   * Name: `cpaneluser_patient_monitor`
4. Create a new user:
   * Username: `cpaneluser_monitor`
   * Password: Choose a strong password.
5. In **Add User To Database**, select the user and database you just created, click **Add**, and check **ALL PRIVILEGES**.

---

### Step 2: Import the Database Schema
1. Return to the cPanel home page and open **phpMyAdmin**.
2. Select your newly created database (`cpaneluser_patient_monitor`) on the left navigation panel.
3. Click the **Import** tab on the top menu bar.
4. Click **Choose File** and upload:
   ```
   database/schema.sql
   ```
5. Click **Go** at the bottom of the page. Verify that all 7 tables are created successfully:
   - `user_accounts`
   - `patients`
   - `devices`
   - `sensor_readings`
   - `ecg_batches`
   - `manual_blood_pressure`
   - `alert_history`

---

### Step 3: Configure Database Credentials in PHP
Open the file `config/db.php` in the cPanel File Manager Code Editor and update the credentials:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'cpaneluser_patient_monitor'); // Your cPanel DB name
define('DB_USER', 'cpaneluser_monitor');         // Your cPanel DB user
define('DB_PASS', 'YourStrongPasswordHere');     // Your cPanel DB password
```

---

### Step 4: Upload Application Files
1. Open **cPanel File Manager**.
2. Navigate to your target web directory:
   * If deploying as the primary website: `public_html/`
   * If deploying in a subfolder: `public_html/patient_monitor/`
3. Upload the project folder structure:
   ```text
   public_html/
   ├── api/
   ├── config/
   ├── includes/
   ├── public/       <-- Contains index.html, manual_bp.html, css/, js/
   └── docs/
   ```
   *(Note: You can copy the contents of `public/` directly into `public_html/` so that `index.html` opens as the root homepage).*

---

### Step 5: Test the Deployment
1. Open your browser and navigate to:
   ```
   https://yourdomain.com/public/index.html
   ```
   (or `https://yourdomain.com/index.html` if placed in root).
2. Verify the **Clinical Telemetry HUD** loads with the animated ECG waveform and the warning banner:
   > **⚠️ Educational Prototype — Not for Diagnosis**
3. Open `manual_bp.html` and submit a test blood pressure record (e.g. 120/80 mmHg). Confirm that the record displays in the historical table immediately.
4. Test the API health endpoint:
   ```
   https://yourdomain.com/api/vitals/latest.php?patient_id=1
   ```
   It should return a valid JSON payload with `status: 200`.

---

## 3. Maintenance & Automated Pruning (Optional Cron Job)
To prevent continuous ECG batches from filling your shared hosting disk over time, add a weekly cPanel Cron Job to clear batches older than 7 days:

```bash
mysql -u cpaneluser_monitor -p'YourPassword' cpaneluser_patient_monitor -e "DELETE FROM ecg_batches WHERE created_at < NOW() - INTERVAL 7 DAY;"
```
