/**
 * Frontend Configuration File
 * ESP32 Home Patient Monitoring System
 */

const APP_CONFIG = {
  // REST API Endpoints (Relative paths work in cPanel public_html)
  api: {
    csrf: '../api/auth/csrf.php',
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
  // Note: For secure HTTPS hosting, broker must support wss:// (port 8084 on EMQX/HiveMQ)
  mqtt: {
    enabled: true,
    host: 'broker.emqx.io',        // Public test broker (replace with your Mosquitto server)
    port: 8084,                   // WSS port (8083 for unencrypted WS)
    path: '/mqtt',
    useSSL: true,
    clientIdPrefix: 'client_web_' + Math.random().toString(16).substring(2, 8),
    topics: {
      ecg: 'patient/device01/ecg',
      vitals: 'patient/device01/vitals',
      heartRate: 'patient/device01/heart_rate',
      max30102: 'patient/device01/max30102',
      temperature: 'patient/device01/temperature',
      status: 'patient/device01/status',
      alerts: 'patient/device01/alerts'
    }
  },

  // Telemetry Polling fallback (ms) when MQTT is connecting or unavailable
  pollingIntervalMs: 2500,

  // Selected Patient ID (Matching MongoDB Document)
  defaultPatientId: 'PT-8802'
};
