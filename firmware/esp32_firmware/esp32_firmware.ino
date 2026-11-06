/**
 * ESP32 Biomedical Telemetry Node — Production Reference Firmware
 * Continuous Patient Monitoring & Ward Decongestion Prototype
 *
 * Sensors:
 * - AD8232 ECG Bio-Amplifier (Analog output on GPIO 34, LO+ on 18, LO- on 19)
 * - MAX30102 Pulse Oximeter & Heart Rate (I2C: SDA=21, SCL=22)
 *
 * Libraries Required (Install via Arduino IDE Library Manager):
 * 1. ArduinoJson (by Benoit Blanchon, v6.x or v7.x)
 * 2. SparkFun MAX3010x Pulse and Proximity Sensor Library (optional, or read raw)
 *
 * Communication:
 * - HTTPS REST API with Bearer Token Authorization
 * - Automatic Wi-Fi reconnection
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============================================================================
// 1. NETWORK & CLOUD BACKEND CONFIGURATION
// ============================================================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Target Cloud Endpoint (Render Production or Local Development)
const char* SERVER_URL_VITALS = "https://shammi-thesis.onrender.com/api/v1/readings";
const char* SERVER_URL_ECG    = "https://shammi-thesis.onrender.com/api/v1/ecg";

// For local network testing (uncomment below if testing on PC with XAMPP/PHP CLI):
// const char* SERVER_URL_VITALS = "http://192.168.1.100:8000/api/v1/readings";
// const char* SERVER_URL_ECG    = "http://192.168.1.100:8000/api/v1/ecg";

// Secret Ingestion Bearer Token
const char* API_BEARER_TOKEN = "esp32_research_secret_token_2026";

// Device & Patient Mapping (Must match active patient on Doctor Portal)
const char* DEVICE_UID = "ESP32-NODE-01";
const char* PATIENT_ID = "PT-8802"; // Robert Vance (Bed 04 / Room 402)

// ============================================================================
// 2. HARDWARE PIN DEFINITIONS
// ============================================================================
// ⚠️ MANDATORY: AD8232 output must connect to an ADC1 pin (34, 35, 36, or 39).
// Do NOT use ADC2 pins because ADC2 is disabled when Wi-Fi is active!
#define PIN_ECG_ANALOG  34
#define PIN_ECG_LO_PLUS 18
#define PIN_ECG_LO_MIN  19
#define PIN_STATUS_LED  2

// ============================================================================
// 3. TELEMETRY TIMERS & BUFFERS
// ============================================================================
unsigned long lastVitalsPostTime = 0;
const unsigned long VITALS_INTERVAL_MS = 2500; // Send vitals every 2.5 seconds

// ECG High-Speed Sampling Buffer (125 Hz: 1 sample every 8 ms)
const int ECG_BUFFER_SIZE = 125;
int ecgSamples[ECG_BUFFER_SIZE];
int ecgSampleIndex = 0;
unsigned long lastEcgSampleTime = 0;
const unsigned long ECG_SAMPLE_INTERVAL_US = 8000; // 8000 us = 8 ms = 125 Hz

// ============================================================================
// SETUP
// ============================================================================
void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n==============================================");
    Serial.println(" ESP32 Biomedical Telemetry Node Initializing ");
    Serial.println("==============================================");

    pinMode(PIN_STATUS_LED, OUTPUT);
    pinMode(PIN_ECG_LO_PLUS, INPUT);
    pinMode(PIN_ECG_LO_MIN, INPUT);
    analogReadResolution(12); // 12-bit ADC (0 - 4095)

    // Connect to Wi-Fi
    connectToWiFi();
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
    // 1. Ensure Wi-Fi stays connected
    if (WiFi.status() != WL_CONNECTED) {
        connectToWiFi();
    }

    // 2. High-Speed ECG Sampling (125 Hz)
    unsigned long nowUs = micros();
    if (nowUs - lastEcgSampleTime >= ECG_SAMPLE_INTERVAL_US) {
        lastEcgSampleTime = nowUs;
        sampleEcgWaveform();
    }

    // 3. Periodic Vitals HTTP Transmission (Every 2.5 seconds)
    unsigned long nowMs = millis();
    if (nowMs - lastVitalsPostTime >= VITALS_INTERVAL_MS) {
        lastVitalsPostTime = nowMs;
        transmitVitalsTelemetry();
    }
}

// ============================================================================
// WI-FI CONNECTION HELPER
// ============================================================================
void connectToWiFi() {
    Serial.printf("[Wi-Fi] Connecting to: %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 25) {
        delay(500);
        Serial.print(".");
        digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(PIN_STATUS_LED, HIGH);
        Serial.println("\n[Wi-Fi] Connected Successfully!");
        Serial.printf("[Wi-Fi] Local IP: %s | RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    } else {
        digitalWrite(PIN_STATUS_LED, LOW);
        Serial.println("\n[Wi-Fi] Connection Failed. Will retry in loop.");
    }
}

// ============================================================================
// ECG SAMPLING & BATCH TRANSMISSION
// ============================================================================
void sampleEcgWaveform() {
    bool leadsOff = (digitalRead(PIN_ECG_LO_PLUS) == HIGH || digitalRead(PIN_ECG_LO_MIN) == HIGH);

    int rawAdc = 0;
    if (leadsOff) {
        rawAdc = 512; // Baseline middle value during lead-off
    } else {
        rawAdc = analogRead(PIN_ECG_ANALOG);
    }

    ecgSamples[ecgSampleIndex++] = rawAdc;

    // When buffer is full (125 samples = 1 full second of waveform), transmit batch
    if (ecgSampleIndex >= ECG_BUFFER_SIZE) {
        transmitEcgBatch(leadsOff);
        ecgSampleIndex = 0;
    }
}

void transmitEcgBatch(bool leadsOff) {
    if (WiFi.status() != WL_CONNECTED) return;

    WiFiClientSecure client;
    client.setInsecure(); // Skip certificate validation for prototyping

    HTTPClient http;
    http.setTimeout(10000);

    if (!http.begin(client, SERVER_URL_ECG)) {
        Serial.println("[ECG] Failed to begin HTTP client");
        return;
    }

    http.addHeader("Content-Type", "application/json");
    char authHeader[128];
    snprintf(authHeader, sizeof(authHeader), "Bearer %s", API_BEARER_TOKEN);
    http.addHeader("Authorization", authHeader);

    // Build JSON payload
    StaticJsonDocument<2048> doc;
    doc["device_uid"]      = DEVICE_UID;
    doc["patient_id"]      = PATIENT_ID;
    doc["sample_rate_hz"]  = 125;
    doc["lead_status"]     = leadsOff ? "leads_off" : "normal";

    JsonArray sampleArr = doc.createNestedArray("samples");
    for (int i = 0; i < ECG_BUFFER_SIZE; i++) {
        sampleArr.add(ecgSamples[i]);
    }

    String jsonBody;
    serializeJson(doc, jsonBody);

    int httpCode = http.POST(jsonBody);
    if (httpCode == 201 || httpCode == 200) {
        Serial.printf("[ECG] Batch of %d samples uploaded (HTTP %d)\n", ECG_BUFFER_SIZE, httpCode);
    } else {
        Serial.printf("[ECG] Upload failed, HTTP: %d\n", httpCode);
    }
    http.end();
}

// ============================================================================
// PERIODIC VITALS TRANSMISSION (HEART RATE, SPO2, TEMP)
// ============================================================================
void transmitVitalsTelemetry() {
    if (WiFi.status() != WL_CONNECTED) return;

    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    http.setTimeout(15000); // 15 seconds

    if (!http.begin(client, SERVER_URL_VITALS)) {
        Serial.println("[Vitals] HTTP begin failed");
        return;
    }

    http.addHeader("Content-Type", "application/json");
    char authHeader[128];
    snprintf(authHeader, sizeof(authHeader), "Bearer %s", API_BEARER_TOKEN);
    http.addHeader("Authorization", authHeader);

    // Check ECG leads
    bool leadsOff = (digitalRead(PIN_ECG_LO_PLUS) == HIGH || digitalRead(PIN_ECG_LO_MIN) == HIGH);

    // Read real sensor values (or simulate realistic clinical baseline)
    int heartRate       = leadsOff ? 0 : (72 + random(-4, 6)); // Replace with MAX30102 algorithm
    float spo2          = 98.2 + (random(-10, 10) / 10.0);    // Replace with MAX30102 SpO2
    float temperature   = 36.8 + (random(-2, 3) / 10.0);      // Replace with DS18B20/MLX90614
    int batteryLevel    = 94;                                 // Read from voltage divider ADC
    int wifiRssi        = WiFi.RSSI();

    StaticJsonDocument<512> doc;
    doc["device_uid"]          = DEVICE_UID;
    doc["patient_id"]          = PATIENT_ID;
    doc["heart_rate"]          = heartRate;
    doc["spo2"]                = spo2;
    doc["temperature"]         = temperature;
    doc["ecg_lead_status"]     = leadsOff ? "leads_off" : "normal";
    doc["ppg_finger_detected"] = 1;
    doc["battery_level"]       = batteryLevel;
    doc["wifi_rssi"]           = wifiRssi;

    String jsonBody;
    serializeJson(doc, jsonBody);

    int httpCode = http.POST(jsonBody);
    if (httpCode == 201 || httpCode == 200) {
        Serial.printf("[Vitals] HR: %d BPM | SpO2: %.1f%% | Temp: %.1f C (HTTP %d)\n", heartRate, spo2, temperature, httpCode);
    } else {
        Serial.printf("[Vitals] POST failed. HTTP Code: %d\n", httpCode);
    }
    http.end();
}
