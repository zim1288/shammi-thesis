# Deployment Instructions for cPanel Shared Hosting
### ESP32 Patient Monitoring System (Biomedical Research Prototype)

This guide provides step-by-step instructions for deploying the platform onto standard cPanel shared hosting.

---

## 1. Hosting Requirements
* **Web Server:** Apache with `mod_rewrite` and `mod_headers` enabled (default on virtually all cPanel hosts).
* **PHP Version:** PHP 8.1 or 8.2 (Recommended: PHP 8.2 selected in cPanel MultiPHP Manager).
* **PHP Extensions:** `json`, `session`, `curl`, `openssl` (enabled by default).
* **Database Options:**
  * **Option A (Zero Setup):** Built-in Atomic JSON Flat Database (`backend/data_store/`). Works immediately without configuring any database server.
  * **Option B (Cloud Database):** MongoDB Atlas free-tier cluster (connects over outbound HTTPS/TLS).

---

## 2. Deployment Procedure

### Step 1: Prepare the Deployment Archive
1. On your local machine, zip all files in the project root:
   * Include: `backend/`, `frontend/`, `docs/`, `index.php`, `router.php`, `.htaccess`, `README.md`, `composer.json`.
   * Ensure hidden files like `.htaccess` are included.

### Step 2: Upload to cPanel File Manager
1. Log into your **cPanel Dashboard** (e.g., `https://yourdomain.com:2083`).
2. Open **File Manager** and navigate into `public_html/`.
3. If deploying to the primary domain, ensure `public_html/` is clean, then click **Upload**.
4. Select your `.zip` archive.
5. Once uploaded, right-click the `.zip` file in File Manager and select **Extract**.

### Step 3: Set Storage Permissions
1. In cPanel File Manager, navigate to `backend/data_store/`.
2. Right-click the `backend/data_store/` directory and select **Change Permissions**.
3. Set permissions to **`775`** (or `755` depending on your cPanel host's suPHP/mod_lsapi configuration) to ensure the web server has write access.

### Step 4: Configure MongoDB Atlas (Optional)
If you wish to use MongoDB Atlas instead of the local flat-file storage:
1. In cPanel File Manager, open `backend/config/mongodb.php`.
2. Update the `MONGO_URI` constant with your MongoDB Atlas connection string:
   ```php
   define('MONGO_URI', 'mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority');
   define('MONGO_DB_NAME', 'patient_monitor');
   ```
3. Save changes.

---

## 3. Verifying the Deployment

1. **Access the Web Portal:**
   Navigate to:
   ```
   https://yourdomain.com/
   ```
   * Unauthenticated visitors are automatically routed to `frontend/auth.html`.
   * Log in using default credentials:
     * **Email:** `doctor@hospital.gov.bd`
     * **Password:** `Doctor@2026!`
   * You will be redirected to the Central Patient Roster (`frontend/patients.html`).

2. **Verify REST v1 API Ingestion:**
   Test the endpoint using cURL or Postman:
   ```bash
   curl -X GET https://yourdomain.com/api/v1/latest?patient_id=PT-8802
   ```

3. **Verify Security Guard:**
   Navigate directly to internal database stores:
   ```
   https://yourdomain.com/backend/data_store/users.json
   ```
   *The server must return **403 Forbidden**, verifying that `.htaccess` rewrite protections are functioning correctly.*
