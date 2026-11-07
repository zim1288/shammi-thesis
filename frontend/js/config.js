/**
 * Frontend Configuration File
 * ESP32 Home Patient Monitoring System
 */

const APP_CONFIG = {
  // REST API Endpoints (Relative paths work in Render and cPanel)
  api: {
    csrf: '../api/auth/csrf.php',
    authConfig: '../api/auth/config.php',
    vitalsLatest: '../api/vitals/latest.php',
    vitalsHistory: '../api/vitals/history.php',
    ecgLatest: '../api/vitals/ecg_latest.php',
    manualBpEntry: '../api/blood_pressure/manual_entry.php',
    manualBpList: '../api/blood_pressure/list.php',
    alertsList: '../api/alerts/list.php',
    alertAcknowledge: '../api/alerts/acknowledge.php',
    deviceStatus: '../api/devices/status.php'
  },

  // MQTT over WebSocket Configuration
  // Disabled by default to prioritize secure, authenticated HTTPS REST polling.
  // Enable only if connecting to an authorized, password-protected Mosquitto/EMQX cluster.
  mqtt: {
    enabled: false,
    host: 'broker.emqx.io',        // Broker address
    port: 8084,                    // WSS port (8083 for unencrypted WS)
    path: '/mqtt',
    useSSL: true,
    clientIdPrefix: 'client_web_' + Math.random().toString(16).substring(2, 8),
    topics: {
      ecg: 'thesis/esp32_monitor/patient/device01/ecg',
      vitals: 'thesis/esp32_monitor/patient/device01/vitals',
      heartRate: 'thesis/esp32_monitor/patient/device01/heart_rate',
      max30102: 'thesis/esp32_monitor/patient/device01/max30102',
      temperature: 'thesis/esp32_monitor/patient/device01/temperature',
      status: 'thesis/esp32_monitor/patient/device01/status',
      alerts: 'thesis/esp32_monitor/patient/device01/alerts'
    }
  },

  // Telemetry Polling fallback (ms) when MQTT is disabled or unavailable
  pollingIntervalMs: 2500,

  // Selected Patient ID (Matching MongoDB Document)
  defaultPatientId: 'PT-8802'
};
