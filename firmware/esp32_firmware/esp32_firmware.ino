/**
 * ESP32 Biomedical Telemetry Node — SINGLE-FILE BUILD (Method A: Device-UID Auto-Resolution)
 * Continuous Patient Monitoring & Ward Decongestion Prototype
 * Device: ESP32-NODE-02  |  Patient: Auto-resolved by Cloud Backend via DEVICE_UID
 *
 * ⚠️ Educational Prototype — Not for Diagnosis.
 *
 * METHOD A CONFIGURATION:
 * In dynamic hospital/home-care IoT architecture, the wearable node only identifies
 * itself by its physical hardware UID (DEVICE_UID = "ESP32-NODE-02").
 * PATIENT_ID is left blank (""), allowing the cloud backend to automatically look up
 * whichever patient is currently enrolled and paired with this device.
 *
 * Sensors:
 * - AD8232 ECG Bio-Amplifier        (analog GPIO34, LO+/LO- GPIO18/19)
 * - MAX30102 Pulse Oximeter / HR    (I2C: SDA21, SCL22)
 * - MLX90614 IR Surface Temperature (I2C: SDA21, SCL22)
 * Outputs:
 * - SSD1306 128x64 OLED             (I2C: SDA21, SCL22)
 * - 3-colour traffic light          (GPIO 27/26/25 — Red/Yellow/Green)
 * - Buzzer (via transistor driver)  (GPIO 23)
 * - Mute button (INPUT_PULLUP)      (GPIO 4)
 * - Wi-Fi status LED                (GPIO 2)
 *
 * Libraries required (Arduino IDE Library Manager — install exactly these):
 *   - ArduinoJson                           (Benoit Blanchon, v6.x/v7.x)
 *   - SparkFun MAX3010x Pulse and Proximity Sensor Library (SparkFun)
 *   - Adafruit MLX90614 Library             (Adafruit)
 *   - Adafruit GFX Library                  (Adafruit)
 *   - Adafruit SSD1306                      (Adafruit)
 *   - Adafruit BusIO                        (Adafruit, auto-installed)
 *
 * Board package: esp32 by Espressif Systems, board "ESP32 Dev Module" / "DOIT ESP32 DEVKIT V1".
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <MAX30105.h>
#include <heartRate.h>
#include <Adafruit_MLX90614.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =============================================================================
// SECTION 1 — PINS
// =============================================================================

// I2C bus (shared by MAX30102, MLX90614, and the SSD1306 OLED)
#define PIN_I2C_SDA 21
#define PIN_I2C_SCL 22

// AD8232 ECG bio-amplifier (ADC1 pin GPIO34 is used; ADC2 is disabled during Wi-Fi)
#define PIN_ECG_ANALOG  34
#define PIN_ECG_LO_PLUS 18   // LO+ : HIGH = electrode detached
#define PIN_ECG_LO_MIN  19   // LO- : HIGH = electrode detached

// Traffic light module (Red / Yellow / Green)
#define PIN_LIGHT_RED    27
#define PIN_LIGHT_YELLOW 26
#define PIN_LIGHT_GREEN  25

// Buzzer (via transistor/driver)
#define PIN_BUZZER 23

// Mute button (one leg to GPIO, other to GND, INPUT_PULLUP)
#define PIN_MUTE_BUTTON 4

// Onboard Wi-Fi status LED
#define PIN_STATUS_LED 2

// OLED display (SSD1306, I2C, shares bus)
#define OLED_SCREEN_WIDTH  128
#define OLED_SCREEN_HEIGHT 64
#define OLED_I2C_ADDRESS   0x3C
#define OLED_RESET_PIN     -1

// MAX30102 / MLX90614 I2C addresses
#define MAX30102_I2C_ADDRESS 0x57
#define MLX90614_I2C_ADDRESS 0x5A

// =============================================================================
// SECTION 2 — CONFIGURATION (METHOD A: DYNAMIC PAIRING VIA DEVICE UID)
// =============================================================================

// Wi-Fi Access Point & Cloud Credentials
// Loads private credentials from gitignored config.h if present; otherwise uses defaults.
#if __has_include("config.h")
#include "config.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID        "YOUR_WIFI_SSID"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD    "YOUR_WIFI_PASSWORD"
#endif
#ifndef SERVER_URL_VITALS
#define SERVER_URL_VITALS "https://shammi-thesis.onrender.com/api/v1/readings"
#endif
#ifndef SERVER_URL_ECG
#define SERVER_URL_ECG    "https://shammi-thesis.onrender.com/api/v1/ecg"
#endif
#ifndef API_BEARER_TOKEN
#define API_BEARER_TOKEN  "shammi_thesis_2026"
#endif
#ifndef DEVICE_UID
#define DEVICE_UID        "ESP32-NODE-02"
#endif
#ifndef PATIENT_ID
#define PATIENT_ID        ""  // METHOD A: Empty string auto-resolves assigned patient from database
#endif

// Local clinical alert thresholds
#define ALERT_ECG_HR_MIN      55     // Bradycardia floor (BPM)
#define ALERT_ECG_HR_MAX      105    // Tachycardia ceiling (BPM)
#define ALERT_SPO2_MIN        94.0   // Hypoxia floor (%)
#define ALERT_TEMP_MIN_C      35.0   // Hypothermia floor (°C, IR surface temp)
#define ALERT_TEMP_MAX_C      38.5   // Fever ceiling (°C, IR surface temp)

#define ALERT_CONFIRM_MS       5000  // Breach persistence required for RED alert
#define ALERT_HR_HYSTERESIS_BPM   3
#define ALERT_SPO2_HYSTERESIS_PCT 1.0
#define ALERT_TEMP_HYSTERESIS_C   0.2

// =============================================================================
// SECTION 3 — SHARED TYPES
// =============================================================================

#define ECG_SAMPLE_RATE_HZ   125
#define ECG_BATCH_SIZE       125   // 1 second of samples per batch

enum AlertLevel { ALERT_GREEN, ALERT_YELLOW, ALERT_RED };

struct AlertInputs {
    bool  ecgLeadsOff;
    bool  ecgHrValid;
    int   ecgHrBpm;
    bool  spo2Valid;
    float spo2Percent;
    bool  tempValid;
    float tempObjectC;
    bool  mlxSensorOk;
    bool  maxSensorOk;
};

struct AlertState {
    AlertLevel level;
    bool  sensorFault;
    bool  physiologicalAlert;
    bool  buzzerMuted;
    const char *reason;
};

struct Max30102Reading {
    int   pulseRateBpm;
    float spo2Percent;
    bool  fingerDetected;
    bool  sensorOk;
    bool  valid;
};

struct Mlx90614Reading {
    float ambientTempC;
    float objectTempC;
    bool  sensorOk;
};

struct EcgBatch {
    int   samples[ECG_BATCH_SIZE];
    int   sampleCount;
    bool  leadsOff;
    unsigned long startMillis;
    unsigned long endMillis;
};

struct OledSnapshot {
    int   ecgHrBpm;
    int   maxPulseBpm;
    float spo2Percent;
    float irTempC;
    bool  ecgLeadsOff;
    bool  maxSensorOk;
    bool  mlxSensorOk;
    bool  wifiConnected;
    AlertLevel alertLevel;
    bool  buzzerMuted;
};

struct VitalsPacket {
    int   ecgHrBpm;
    int   maxPulseBpm;
    float spo2Percent;
    float irTempC;
    bool  ecgLeadsOff;
    bool  maxFingerDetected;
    bool  maxSensorOk;
    bool  mlxSensorOk;
    int   batteryPercent;
    AlertLevel alertLevel;
    const char *alertReason;
    bool  sensorFault;
    bool  physiologicalAlert;
    bool  buzzerMuted;
};

// =============================================================================
// SECTION 4 — WI-FI MODULE
// =============================================================================

static unsigned long lastReconnectAttemptMs = 0;
static const unsigned long RECONNECT_RETRY_INTERVAL_MS = 5000;

void wifiInit() {
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    Serial.printf("[WiFi] Connecting to \"%s\"", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 24) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Connected. IP=%s RSSI=%d dBm\n",
                      WiFi.localIP().toString().c_str(), WiFi.RSSI());
    } else {
        Serial.println("\n[WiFi] Initial connect failed — retrying in background.");
    }
}

void wifiEnsureConnected() {
    if (WiFi.status() == WL_CONNECTED) return;
    unsigned long now = millis();
    if (now - lastReconnectAttemptMs < RECONNECT_RETRY_INTERVAL_MS) return;
    lastReconnectAttemptMs = now;
    Serial.println("[WiFi] Not connected — reconnecting...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

bool wifiIsConnected() {
    return WiFi.status() == WL_CONNECTED;
}

// =============================================================================
// SECTION 5 — ECG MODULE (AD8232)
// =============================================================================

static const unsigned long SAMPLE_INTERVAL_US = 1000000UL / ECG_SAMPLE_RATE_HZ;

static int  ecgBufferA[ECG_BATCH_SIZE];
static int  ecgBufferB[ECG_BATCH_SIZE];
static int *ecgWriteBuffer = ecgBufferA;
static int *ecgReadyBuffer = nullptr;
static int  ecgWriteIndex = 0;
static unsigned long ecgBatchStartMillis = 0;
static bool ecgBatchLeadsOff = false;
static int  ecgReadySampleCount = 0;
static bool ecgReadyLeadsOff = false;
static unsigned long ecgReadyStartMillis = 0;
static unsigned long ecgReadyEndMillis = 0;

static unsigned long ecgLastSampleTimeUs = 0;
static bool ecgCurrentLeadsOff = false;
static int  ecgCurrentHrBpm = -1;

void ecgInit() {
    pinMode(PIN_ECG_LO_PLUS, INPUT);
    pinMode(PIN_ECG_LO_MIN, INPUT);
    analogReadResolution(12); // 0-4095
    ecgBatchStartMillis = millis();
}

static int estimateEcgHeartRate(const int *samples, int count, unsigned long sampleIntervalMs) {
    if (count < 20) return -1;

    int minV = samples[0], maxV = samples[0];
    long sum = 0;
    for (int i = 0; i < count; i++) {
        minV = min(minV, samples[i]);
        maxV = max(maxV, samples[i]);
        sum += samples[i];
    }
    int swing = maxV - minV;
    if (swing < 50) return -1;

    long mean = sum / count;
    int threshold = mean + (int)(swing * 0.5f);

    int peakCount = 0;
    long intervalSumMs = 0;
    int lastPeakIndex = -1000;
    const int MIN_PEAK_SPACING_SAMPLES = (int)(0.3f * ECG_SAMPLE_RATE_HZ);

    for (int i = 1; i < count - 1; i++) {
        bool isLocalMax = samples[i] > samples[i - 1] && samples[i] >= samples[i + 1];
        if (isLocalMax && samples[i] > threshold && (i - lastPeakIndex) > MIN_PEAK_SPACING_SAMPLES) {
            if (lastPeakIndex > -1000) {
                intervalSumMs += (long)(i - lastPeakIndex) * sampleIntervalMs;
                peakCount++;
            }
            lastPeakIndex = i;
        }
    }

    if (peakCount < 1) return -1;
    float avgIntervalMs = intervalSumMs / (float)peakCount;
    if (avgIntervalMs <= 0) return -1;
    int bpm = (int)(60000.0f / avgIntervalMs);
    if (bpm < 30 || bpm > 220) return -1;
    return bpm;
}

void ecgSampleTick() {
    unsigned long nowUs = micros();
    if (nowUs - ecgLastSampleTimeUs < SAMPLE_INTERVAL_US) return;
    ecgLastSampleTimeUs = nowUs;

    bool leadsOff = (digitalRead(PIN_ECG_LO_PLUS) == HIGH) || (digitalRead(PIN_ECG_LO_MIN) == HIGH);
    ecgCurrentLeadsOff = leadsOff;
    int sample = leadsOff ? 2048 : analogRead(PIN_ECG_ANALOG);
    ecgBatchLeadsOff = ecgBatchLeadsOff || leadsOff;

    ecgWriteBuffer[ecgWriteIndex++] = sample;

    if (ecgWriteIndex >= ECG_BATCH_SIZE) {
        unsigned long sampleIntervalMs = 1000UL / ECG_SAMPLE_RATE_HZ;
        ecgCurrentHrBpm = ecgBatchLeadsOff ? -1 : estimateEcgHeartRate(ecgWriteBuffer, ECG_BATCH_SIZE, sampleIntervalMs);

        ecgReadyBuffer = ecgWriteBuffer;
        ecgReadySampleCount = ECG_BATCH_SIZE;
        ecgReadyLeadsOff = ecgBatchLeadsOff;
        ecgReadyStartMillis = ecgBatchStartMillis;
        ecgReadyEndMillis = millis();

        ecgWriteBuffer = (ecgWriteBuffer == ecgBufferA) ? ecgBufferB : ecgBufferA;
        ecgWriteIndex = 0;
        ecgBatchStartMillis = millis();
        ecgBatchLeadsOff = false;
    }
}

bool ecgTakeReadyBatch(EcgBatch *outBatch) {
    if (ecgReadyBuffer == nullptr) return false;

    memcpy(outBatch->samples, ecgReadyBuffer, sizeof(int) * ecgReadySampleCount);
    outBatch->sampleCount = ecgReadySampleCount;
    outBatch->leadsOff    = ecgReadyLeadsOff;
    outBatch->startMillis = ecgReadyStartMillis;
    outBatch->endMillis   = ecgReadyEndMillis;

    ecgReadyBuffer = nullptr;
    return true;
}

bool ecgLeadsOff() { return ecgCurrentLeadsOff; }
int  ecgDerivedHeartRateBpm() { return ecgCurrentHrBpm; }

// =============================================================================
// SECTION 6 — MAX30102 MODULE
// =============================================================================

static MAX30105 particleSensor;

static const byte MAX_RATE_SAMPLE_WINDOW = 4;
static long  maxIrValueBuffer[MAX_RATE_SAMPLE_WINDOW];
static byte  maxRateSpot = 0;
static long  maxLastBeatMs = 0;

static const int MAX_AC_DC_WINDOW = 50;
static long maxRedBuf[MAX_AC_DC_WINDOW];
static long maxIrBuf[MAX_AC_DC_WINDOW];
static int  maxAcDcIndex = 0;
static bool maxAcDcWindowFull = false;

static const long FINGER_PRESENCE_IR_THRESHOLD = 50000;

static portMUX_TYPE max30102Mux = portMUX_INITIALIZER_UNLOCKED;
static Max30102Reading g_max30102Reading = { -1, -1.0f, false, false, false };

bool max30102Init() {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

    if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
        Serial.println("[MAX30102] Not found on I2C bus — check wiring (address 0x57).");
        portENTER_CRITICAL(&max30102Mux);
        g_max30102Reading.sensorOk = false;
        portEXIT_CRITICAL(&max30102Mux);
        return false;
    }

    byte ledBrightness = 0x3F; // ~6.2mA
    byte sampleAverage  = 4;
    byte ledMode        = 2;    // Red + IR
    int  sampleRate     = 100;  // Hz
    int  pulseWidth     = 411;
    int  adcRange       = 4096;
    particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);

    portENTER_CRITICAL(&max30102Mux);
    g_max30102Reading.sensorOk = true;
    portEXIT_CRITICAL(&max30102Mux);
    Serial.println("[MAX30102] Initialized.");
    return true;
}

static float estimateSpo2FromRatio() {
    if (!maxAcDcWindowFull) return -1.0f;

    long redMin = LONG_MAX, redMax = LONG_MIN, irMin = LONG_MAX, irMax = LONG_MIN;
    long redSum = 0, irSum = 0;
    for (int i = 0; i < MAX_AC_DC_WINDOW; i++) {
        redMin = min(redMin, maxRedBuf[i]);
        redMax = max(redMax, maxRedBuf[i]);
        irMin  = min(irMin, maxIrBuf[i]);
        irMax  = max(irMax, maxIrBuf[i]);
        redSum += maxRedBuf[i];
        irSum  += maxIrBuf[i];
    }
    float redDc = redSum / (float)MAX_AC_DC_WINDOW;
    float irDc  = irSum  / (float)MAX_AC_DC_WINDOW;
    float redAc = (float)(redMax - redMin);
    float irAc  = (float)(irMax - irMin);

    if (redDc <= 0 || irDc <= 0 || irAc <= 0) return -1.0f;

    float r = (redAc / redDc) / (irAc / irDc);
    float spo2 = 110.0f - 25.0f * r;

    if (spo2 > 100.0f) spo2 = 100.0f;
    if (spo2 < 60.0f)  spo2 = 60.0f;
    return spo2;
}

void max30102Update() {
    bool sensorOk;
    portENTER_CRITICAL(&max30102Mux);
    sensorOk = g_max30102Reading.sensorOk;
    portEXIT_CRITICAL(&max30102Mux);
    if (!sensorOk) return;

    particleSensor.check();

    bool fingerDetected = false;
    int  bpmOut = -1;
    float spo2Out = -1.0f;

    while (particleSensor.available()) {
        long irValue  = particleSensor.getFIFOIR();
        long redValue = particleSensor.getFIFORed();

        fingerDetected = (irValue > FINGER_PRESENCE_IR_THRESHOLD);

        if (fingerDetected && checkForBeat(irValue)) {
            long delta = millis() - maxLastBeatMs;
            maxLastBeatMs = millis();
            float instantBpm = 60.0f / (delta / 1000.0f);
            if (instantBpm > 30 && instantBpm < 220) {
                maxIrValueBuffer[maxRateSpot++] = (long)instantBpm;
                maxRateSpot %= MAX_RATE_SAMPLE_WINDOW;
                long sum = 0;
                for (byte i = 0; i < MAX_RATE_SAMPLE_WINDOW; i++) sum += maxIrValueBuffer[i];
                bpmOut = (int)(sum / MAX_RATE_SAMPLE_WINDOW);
            }
        }

        if (fingerDetected) {
            maxRedBuf[maxAcDcIndex] = redValue;
            maxIrBuf[maxAcDcIndex]  = irValue;
            maxAcDcIndex = (maxAcDcIndex + 1) % MAX_AC_DC_WINDOW;
            if (maxAcDcIndex == 0) maxAcDcWindowFull = true;
        } else {
            maxAcDcWindowFull = false;
            maxAcDcIndex = 0;
        }

        particleSensor.nextSample();
    }

    if (fingerDetected) {
        spo2Out = estimateSpo2FromRatio();
    }

    portENTER_CRITICAL(&max30102Mux);
    g_max30102Reading.fingerDetected = fingerDetected;
    if (bpmOut > 0)  g_max30102Reading.pulseRateBpm = bpmOut;
    if (!fingerDetected) g_max30102Reading.pulseRateBpm = -1;
    if (spo2Out > 0) g_max30102Reading.spo2Percent = spo2Out;
    if (!fingerDetected) g_max30102Reading.spo2Percent = -1.0f;
    g_max30102Reading.valid = fingerDetected && g_max30102Reading.pulseRateBpm > 0 && g_max30102Reading.spo2Percent > 0;
    portEXIT_CRITICAL(&max30102Mux);
}

Max30102Reading max30102GetReading() {
    Max30102Reading snapshot;
    portENTER_CRITICAL(&max30102Mux);
    snapshot = g_max30102Reading;
    portEXIT_CRITICAL(&max30102Mux);
    return snapshot;
}

// =============================================================================
// SECTION 7 — MLX90614 MODULE
// =============================================================================

static Adafruit_MLX90614 mlx = Adafruit_MLX90614();
static portMUX_TYPE mlxMux = portMUX_INITIALIZER_UNLOCKED;
static Mlx90614Reading g_mlxReading = { NAN, NAN, false };

bool mlx90614Init() {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

    bool ok = mlx.begin(MLX90614_I2C_ADDRESS, &Wire);
    portENTER_CRITICAL(&mlxMux);
    g_mlxReading.sensorOk = ok;
    portEXIT_CRITICAL(&mlxMux);

    if (!ok) {
        Serial.println("[MLX90614] Not found on I2C bus — check wiring (address 0x5A).");
    } else {
        Serial.println("[MLX90614] Initialized.");
    }
    return ok;
}

void mlx90614Update() {
    bool sensorOk;
    portENTER_CRITICAL(&mlxMux);
    sensorOk = g_mlxReading.sensorOk;
    portEXIT_CRITICAL(&mlxMux);
    if (!sensorOk) return;

    float ambient = mlx.readAmbientTempC();
    float object  = mlx.readObjectTempC();

    bool readOk = !isnan(ambient) && !isnan(object) && object > -40.0f && object < 125.0f;

    portENTER_CRITICAL(&mlxMux);
    if (readOk) {
        g_mlxReading.ambientTempC = ambient;
        g_mlxReading.objectTempC  = object;
    }
    g_mlxReading.sensorOk = readOk || g_mlxReading.sensorOk;
    portEXIT_CRITICAL(&mlxMux);
}

Mlx90614Reading mlx90614GetReading() {
    Mlx90614Reading snapshot;
    portENTER_CRITICAL(&mlxMux);
    snapshot = g_mlxReading;
    portEXIT_CRITICAL(&mlxMux);
    return snapshot;
}

// =============================================================================
// SECTION 8 — ALERT MODULE
// =============================================================================

static AlertState alertState = { ALERT_GREEN, false, false, false, "nominal" };

static bool alertButtonLastRaw = HIGH;
static bool alertButtonStable = HIGH;
static unsigned long alertButtonLastChangeMs = 0;
static const unsigned long ALERT_DEBOUNCE_MS = 40;

static unsigned long hrBreachStartMs   = 0;
static unsigned long spo2BreachStartMs = 0;
static unsigned long tempBreachStartMs = 0;
static bool hrBreachConfirmed   = false;
static bool spo2BreachConfirmed = false;
static bool tempBreachConfirmed = false;

void alertInit() {
    pinMode(PIN_LIGHT_RED, OUTPUT);
    pinMode(PIN_LIGHT_YELLOW, OUTPUT);
    pinMode(PIN_LIGHT_GREEN, OUTPUT);
    pinMode(PIN_BUZZER, OUTPUT);
    pinMode(PIN_MUTE_BUTTON, INPUT_PULLUP);

    digitalWrite(PIN_LIGHT_RED, LOW);
    digitalWrite(PIN_LIGHT_YELLOW, LOW);
    digitalWrite(PIN_LIGHT_GREEN, HIGH);
    digitalWrite(PIN_BUZZER, LOW);
}

void alertPollMuteButton() {
    bool raw = digitalRead(PIN_MUTE_BUTTON);
    unsigned long now = millis();

    if (raw != alertButtonLastRaw) {
        alertButtonLastChangeMs = now;
        alertButtonLastRaw = raw;
    }

    if ((now - alertButtonLastChangeMs) > ALERT_DEBOUNCE_MS && alertButtonStable != raw) {
        alertButtonStable = raw;
        if (alertButtonStable == LOW && alertState.physiologicalAlert) {
            alertState.buzzerMuted = true;
            digitalWrite(PIN_BUZZER, LOW);
            Serial.println("[Alert] Buzzer muted for current episode.");
        }
    }
}

static bool confirmBreach(bool pastLimitNow, unsigned long *startMs, bool *confirmed, unsigned long nowMs) {
    if (!pastLimitNow) {
        *startMs = 0;
        *confirmed = false;
        return false;
    }
    if (*startMs == 0) {
        *startMs = nowMs;
    }
    if (!*confirmed && (nowMs - *startMs) >= ALERT_CONFIRM_MS) {
        *confirmed = true;
    }
    return *confirmed;
}

void alertUpdate(const AlertInputs &in) {
    unsigned long now = millis();

    bool sensorFault = in.ecgLeadsOff || !in.maxSensorOk || !in.mlxSensorOk ||
                        (!in.ecgHrValid && !in.spo2Valid && !in.tempValid);

    bool hrPast = in.ecgHrValid &&
        (in.ecgHrBpm < ALERT_ECG_HR_MIN || in.ecgHrBpm > ALERT_ECG_HR_MAX);
    if (hrBreachConfirmed && in.ecgHrValid) {
        bool stillBreached = (in.ecgHrBpm < ALERT_ECG_HR_MIN + ALERT_HR_HYSTERESIS_BPM) ||
                              (in.ecgHrBpm > ALERT_ECG_HR_MAX - ALERT_HR_HYSTERESIS_BPM);
        hrPast = hrPast || stillBreached;
    }
    bool hrAlert = confirmBreach(hrPast, &hrBreachStartMs, &hrBreachConfirmed, now);

    bool spo2Past = in.spo2Valid && (in.spo2Percent < ALERT_SPO2_MIN);
    if (spo2BreachConfirmed && in.spo2Valid) {
        spo2Past = spo2Past || (in.spo2Percent < ALERT_SPO2_MIN + ALERT_SPO2_HYSTERESIS_PCT);
    }
    bool spo2Alert = confirmBreach(spo2Past, &spo2BreachStartMs, &spo2BreachConfirmed, now);

    bool tempPast = in.tempValid &&
        (in.tempObjectC < ALERT_TEMP_MIN_C || in.tempObjectC > ALERT_TEMP_MAX_C);
    if (tempBreachConfirmed && in.tempValid) {
        bool stillBreached = (in.tempObjectC < ALERT_TEMP_MIN_C + ALERT_TEMP_HYSTERESIS_C) ||
                              (in.tempObjectC > ALERT_TEMP_MAX_C - ALERT_TEMP_HYSTERESIS_C);
        tempPast = tempPast || stillBreached;
    }
    bool tempAlert = confirmBreach(tempPast, &tempBreachStartMs, &tempBreachConfirmed, now);

    bool physiologicalAlert = hrAlert || spo2Alert || tempAlert;

    const char *reason = "nominal";
    if (physiologicalAlert) {
        reason = hrAlert ? "heart_rate_out_of_range"
               : spo2Alert ? "low_spo2"
               : "temperature_out_of_range";
    } else if (sensorFault) {
        reason = in.ecgLeadsOff ? "ecg_leads_off"
                : !in.maxSensorOk ? "max30102_disconnected"
                : !in.mlxSensorOk ? "mlx90614_disconnected"
                : "signal_invalid";
    }

    if (physiologicalAlert && !alertState.physiologicalAlert) {
        alertState.buzzerMuted = false;
    }
    if (!physiologicalAlert) {
        alertState.buzzerMuted = false;
    }

    alertState.sensorFault = sensorFault;
    alertState.physiologicalAlert = physiologicalAlert;
    alertState.reason = reason;
    alertState.level = physiologicalAlert ? ALERT_RED : (sensorFault ? ALERT_YELLOW : ALERT_GREEN);

    digitalWrite(PIN_LIGHT_RED,    alertState.level == ALERT_RED    ? HIGH : LOW);
    digitalWrite(PIN_LIGHT_YELLOW, alertState.level == ALERT_YELLOW ? HIGH : LOW);
    digitalWrite(PIN_LIGHT_GREEN,  alertState.level == ALERT_GREEN  ? HIGH : LOW);

    digitalWrite(PIN_BUZZER, (alertState.physiologicalAlert && !alertState.buzzerMuted) ? HIGH : LOW);
}

AlertState alertGetState() { return alertState; }

// =============================================================================
// SECTION 9 — OLED MODULE
// =============================================================================

static Adafruit_SSD1306 display(OLED_SCREEN_WIDTH, OLED_SCREEN_HEIGHT, &Wire, OLED_RESET_PIN);
static bool oledOk = false;

bool oledInit() {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    oledOk = display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDRESS);
    if (!oledOk) {
        Serial.println("[OLED] Not found on I2C bus — check wiring (address 0x3C).");
        return false;
    }
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("Patient Monitor");
    display.println("Booting...");
    display.display();
    Serial.println("[OLED] Initialized.");
    return true;
}

static const char *alertLabel(AlertLevel lvl) {
    switch (lvl) {
        case ALERT_RED:    return "RED ALERT";
        case ALERT_YELLOW: return "SENSOR FAULT";
        default:           return "NORMAL";
    }
}

void oledRender(const OledSnapshot &s) {
    if (!oledOk) return;

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);

    display.print("ECG HR: ");
    if (s.ecgLeadsOff || s.ecgHrBpm <= 0) display.println("-- bpm (leads off)");
    else { display.print(s.ecgHrBpm); display.println(" bpm"); }

    display.print("PPG HR: ");
    if (!s.maxSensorOk) display.println("-- (sensor fault)");
    else if (s.maxPulseBpm <= 0) display.println("-- (no finger)");
    else { display.print(s.maxPulseBpm); display.println(" bpm"); }

    display.print("SpO2:   ");
    if (!s.maxSensorOk || s.spo2Percent <= 0) display.println("-- %");
    else { display.print(s.spo2Percent, 1); display.println(" %"); }

    display.print("IR Temp:");
    if (!s.mlxSensorOk || isnan(s.irTempC)) display.println(" -- C");
    else { display.print(s.irTempC, 1); display.println(" C"); }

    display.print("WiFi: ");
    display.println(s.wifiConnected ? "connected" : "offline (buffering)");

    display.setCursor(0, 48);
    display.print(alertLabel(s.alertLevel));
    if (s.alertLevel == ALERT_RED && s.buzzerMuted) {
        display.print(" (muted)");
    }

    display.display();
}

// =============================================================================
// SECTION 10 — API / NETWORKING MODULE (runs pinned to core 0)
// =============================================================================

static const int VITALS_QUEUE_LEN = 10;
static const int ECG_QUEUE_LEN    = 20;

static QueueHandle_t vitalsQueue = nullptr;
static QueueHandle_t ecgQueue    = nullptr;
static TaskHandle_t networkTaskHandle = nullptr;

static const char *alertLevelStr(AlertLevel lvl) {
    switch (lvl) {
        case ALERT_RED:    return "red";
        case ALERT_YELLOW: return "yellow";
        default:           return "green";
    }
}

static bool postJson(const char *url, const String &body) {
    if (!wifiIsConnected()) return false;

    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    http.setTimeout(15000);

    if (!http.begin(client, url)) {
        Serial.printf("[API] http.begin() failed for %s\n", url);
        return false;
    }
    http.addHeader("Content-Type", "application/json");
    char authHeader[128];
    snprintf(authHeader, sizeof(authHeader), "Bearer %s", API_BEARER_TOKEN);
    http.addHeader("Authorization", authHeader);

    int code = http.POST(body);
    bool ok = (code == 200 || code == 201);
    if (!ok) {
        Serial.printf("[API] POST %s failed, HTTP %d\n", url, code);
    }
    http.end();
    return ok;
}

static void sendVitals(const VitalsPacket &p) {
    StaticJsonDocument<768> doc;
    doc["device_uid"] = DEVICE_UID;
    // METHOD A: Empty patient_id prompts the cloud backend to resolve
    // the patient currently paired with DEVICE_UID in the database.
    doc["patient_id"] = PATIENT_ID;

    doc["heart_rate"]          = p.ecgLeadsOff ? 0 : (p.ecgHrBpm > 0 ? p.ecgHrBpm : (p.maxPulseBpm > 0 ? p.maxPulseBpm : 0));
    doc["ecg_heart_rate"]      = p.ecgHrBpm;
    doc["max30102_pulse_rate"] = p.maxPulseBpm;
    doc["spo2"]                = p.spo2Percent;
    doc["temperature"]         = p.irTempC;
    doc["ecg_lead_status"]     = p.ecgLeadsOff ? "leads_off" : "normal";
    doc["ppg_finger_detected"] = p.maxFingerDetected ? 1 : 0;
    doc["battery_level"]       = p.batteryPercent;
    doc["wifi_rssi"]           = WiFi.RSSI();

    doc["local_alert_level"]      = alertLevelStr(p.alertLevel);
    doc["local_alert_reason"]     = p.alertReason;
    doc["sensor_fault"]           = p.sensorFault;
    doc["physiological_alert"]    = p.physiologicalAlert;
    doc["buzzer_muted"]           = p.buzzerMuted;
    doc["max30102_sensor_ok"]     = p.maxSensorOk;
    doc["mlx90614_sensor_ok"]     = p.mlxSensorOk;

    String body;
    serializeJson(doc, body);
    postJson(SERVER_URL_VITALS, body);
}

static void sendEcgBatch(const EcgBatch &batch) {
    StaticJsonDocument<4096> doc;
    doc["device_uid"]     = DEVICE_UID;
    doc["patient_id"]     = PATIENT_ID;
    doc["sample_rate_hz"] = ECG_SAMPLE_RATE_HZ;
    doc["lead_status"]    = batch.leadsOff ? "leads_off" : "normal";
    doc["start_time"]     = batch.startMillis;
    doc["end_time"]       = batch.endMillis;

    JsonArray arr = doc.createNestedArray("samples");
    for (int i = 0; i < batch.sampleCount; i++) {
        arr.add(batch.samples[i]);
    }

    String body;
    serializeJson(doc, body);
    postJson(SERVER_URL_ECG, body);
}

static void networkTaskLoop(void *param) {
    for (;;) {
        wifiEnsureConnected();

        VitalsPacket vp;
        if (xQueueReceive(vitalsQueue, &vp, pdMS_TO_TICKS(50)) == pdTRUE) {
            sendVitals(vp);
        }

        EcgBatch *batchPtr = nullptr;
        if (xQueueReceive(ecgQueue, &batchPtr, pdMS_TO_TICKS(50)) == pdTRUE) {
            if (batchPtr != nullptr) {
                sendEcgBatch(*batchPtr);
                free(batchPtr);
            }
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void apiInit() {
    vitalsQueue = xQueueCreate(VITALS_QUEUE_LEN, sizeof(VitalsPacket));
    ecgQueue    = xQueueCreate(ECG_QUEUE_LEN, sizeof(EcgBatch *));

    xTaskCreatePinnedToCore(
        networkTaskLoop,
        "NetworkTask",
        8192,
        nullptr,
        1,
        &networkTaskHandle,
        0
    );
}

void apiEnqueueVitals(const VitalsPacket &packet) {
    if (xQueueSend(vitalsQueue, &packet, 0) != pdTRUE) {
        VitalsPacket discard;
        xQueueReceive(vitalsQueue, &discard, 0);
        xQueueSend(vitalsQueue, &packet, 0);
    }
}

void apiEnqueueEcgBatch(const EcgBatch &batch) {
    EcgBatch *copy = (EcgBatch *)malloc(sizeof(EcgBatch));
    if (copy == nullptr) {
        Serial.println("[API] malloc failed for ECG batch — dropping sample, heap low.");
        return;
    }
    memcpy(copy, &batch, sizeof(EcgBatch));

    if (xQueueSend(ecgQueue, &copy, 0) != pdTRUE) {
        EcgBatch *oldest = nullptr;
        if (xQueueReceive(ecgQueue, &oldest, 0) == pdTRUE && oldest != nullptr) {
            free(oldest);
        }
        if (xQueueSend(ecgQueue, &copy, 0) != pdTRUE) {
            free(copy);
        }
    }
}

// =============================================================================
// SECTION 11 — setup() / loop()
// =============================================================================

static const unsigned long ALERT_EVAL_INTERVAL_MS  = 500;
static const unsigned long OLED_UPDATE_INTERVAL_MS = 1000;
static const unsigned long VITALS_POST_INTERVAL_MS = 2500;

static unsigned long lastAlertEvalMs  = 0;
static unsigned long lastOledMs       = 0;
static unsigned long lastVitalsPostMs = 0;

void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("\n==============================================");
    Serial.println(" ESP32 Home Patient Monitoring Node — Booting ");
    Serial.println(" Device UID: " DEVICE_UID);
    Serial.println(" Mode: Method A (Device-UID Auto-Resolution)  ");
    Serial.println("==============================================");

    pinMode(PIN_STATUS_LED, OUTPUT);

    alertInit();
    ecgInit();
    bool maxOk = max30102Init();
    bool mlxOk = mlx90614Init();
    oledInit();

    wifiInit();
    apiInit();

    if (!maxOk) Serial.println("[Setup] WARNING: MAX30102 not detected at boot.");
    if (!mlxOk) Serial.println("[Setup] WARNING: MLX90614 not detected at boot.");

    Serial.println("[Setup] Complete. Entering main loop.");
}

void loop() {
    unsigned long now = millis();

    // 1. High-rate ECG sampling
    ecgSampleTick();

    // 2. Drain a completed ECG batch to network queue
    static EcgBatch pendingBatch;
    if (ecgTakeReadyBatch(&pendingBatch)) {
        apiEnqueueEcgBatch(pendingBatch);
    }

    // 3. MAX30102 FIFO read
    max30102Update();

    // 4. Mute button polling
    alertPollMuteButton();

    // 5. Wi-Fi status LED
    digitalWrite(PIN_STATUS_LED, wifiIsConnected() ? HIGH : LOW);

    // 6. MLX90614 read + alert evaluation (every 500ms)
    if (now - lastAlertEvalMs >= ALERT_EVAL_INTERVAL_MS) {
        lastAlertEvalMs = now;

        mlx90614Update();
        Max30102Reading maxR = max30102GetReading();
        Mlx90614Reading mlxR = mlx90614GetReading();
        bool leadsOff = ecgLeadsOff();
        int  ecgHr    = ecgDerivedHeartRateBpm();

        AlertInputs inputs;
        inputs.ecgLeadsOff = leadsOff;
        inputs.ecgHrValid  = !leadsOff && ecgHr > 0;
        inputs.ecgHrBpm    = ecgHr;
        inputs.spo2Valid   = maxR.valid && maxR.spo2Percent > 0;
        inputs.spo2Percent = maxR.spo2Percent;
        inputs.tempValid   = mlxR.sensorOk && !isnan(mlxR.objectTempC);
        inputs.tempObjectC = mlxR.objectTempC;
        inputs.mlxSensorOk = mlxR.sensorOk;
        inputs.maxSensorOk = maxR.sensorOk;

        alertUpdate(inputs);
    }

    // 7. OLED refresh (every 1000ms)
    if (now - lastOledMs >= OLED_UPDATE_INTERVAL_MS) {
        lastOledMs = now;

        Max30102Reading maxR = max30102GetReading();
        Mlx90614Reading mlxR = mlx90614GetReading();
        AlertState currentAlert = alertGetState();

        OledSnapshot snap;
        snap.ecgHrBpm      = ecgDerivedHeartRateBpm();
        snap.maxPulseBpm   = maxR.pulseRateBpm;
        snap.spo2Percent   = maxR.spo2Percent;
        snap.irTempC       = mlxR.objectTempC;
        snap.ecgLeadsOff   = ecgLeadsOff();
        snap.maxSensorOk   = maxR.sensorOk;
        snap.mlxSensorOk   = mlxR.sensorOk;
        snap.wifiConnected = wifiIsConnected();
        snap.alertLevel    = currentAlert.level;
        snap.buzzerMuted   = currentAlert.buzzerMuted;

        oledRender(snap);
    }

    // 8. Push vitals snapshot to the network queue every ~2.5s
    if (now - lastVitalsPostMs >= VITALS_POST_INTERVAL_MS) {
        lastVitalsPostMs = now;

        Max30102Reading maxR = max30102GetReading();
        Mlx90614Reading mlxR = mlx90614GetReading();
        AlertState currentAlert = alertGetState();

        VitalsPacket vp;
        vp.ecgHrBpm           = ecgDerivedHeartRateBpm();
        vp.maxPulseBpm        = maxR.pulseRateBpm;
        vp.spo2Percent        = maxR.spo2Percent;
        vp.irTempC            = mlxR.objectTempC;
        vp.ecgLeadsOff        = ecgLeadsOff();
        vp.maxFingerDetected  = maxR.fingerDetected;
        vp.maxSensorOk        = maxR.sensorOk;
        vp.mlxSensorOk        = mlxR.sensorOk;
        vp.batteryPercent     = 100;
        vp.alertLevel         = currentAlert.level;
        vp.alertReason        = currentAlert.reason;
        vp.sensorFault        = currentAlert.sensorFault;
        vp.physiologicalAlert = currentAlert.physiologicalAlert;
        vp.buzzerMuted        = currentAlert.buzzerMuted;

        apiEnqueueVitals(vp);
    }
}
