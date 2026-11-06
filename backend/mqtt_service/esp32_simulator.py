#!/usr/bin/env python3
"""
ESP32 Hardware Simulator for Educational Patient Monitoring System
Generates realistic biosignals (ECG Lead-II batches, MAX30102 PPG, IR Temp)
and publishes via MQTT or directly invokes the PHP HTTP ingestion API.
"""

import time
import math
import json
import random
import urllib.request
import urllib.error

# Configuration
DEVICE_UID = "ESP32-NODE-01"
PATIENT_ID = "PT-8802"
API_URL = "http://localhost:8000/api/ingest/vitals.php"
ECG_BATCH_URL = "http://localhost:8000/api/ingest/ecg_batch.php"
API_KEY = "esp32_research_secret_token_2026"

SAMPLE_RATE_HZ = 125
BATCH_INTERVAL_SEC = 1.0  # Send 1 batch every 1 second (125 samples)

def generate_ecg_sample(phase):
    """Generates synthetic P-Q-R-S-T ECG waveform in millivolts"""
    p = phase % 1.0
    val = 0.0

    # P-wave
    if 0.15 < p < 0.25:
        val += math.sin((p - 0.15) * math.pi / 0.10) * 0.18
    # Q-dip
    elif 0.35 <= p < 0.38:
        val -= math.sin((p - 0.35) * math.pi / 0.03) * 0.14
    # R-peak (steep spike)
    elif 0.38 <= p < 0.43:
        val += math.sin((p - 0.38) * math.pi / 0.05) * 1.05
    # S-dip
    elif 0.43 <= p < 0.47:
        val -= math.sin((p - 0.43) * math.pi / 0.04) * 0.30
    # T-wave
    elif 0.60 <= p < 0.78:
        val += math.sin((p - 0.60) * math.pi / 0.18) * 0.28

    # Small biological baseline noise
    val += (random.random() - 0.5) * 0.04
    return round(val, 4)

def run_simulation():
    print("=" * 65)
    print("ESP32 RESEARCH HARDWARE SIMULATOR STARTED")
    print(f"Device UID: {DEVICE_UID} | Target Patient ID: {PATIENT_ID}")
    print("=" * 65)

    phase = 0.0
    cycle = 0

    while True:
        cycle += 1
        start_time = time.strftime("%Y-%m-%d %H:%M:%S")

        # 1. Synthesize 1 second of ECG samples (125 points)
        samples = []
        for _ in range(SAMPLE_RATE_HZ):
            phase += (1.2 / SAMPLE_RATE_HZ)  # ~72 BPM
            samples.append(generate_ecg_sample(phase))

        # 2. Physiological Vitals Readout
        ecg_hr = random.randint(72, 76)
        max30102_pr = ecg_hr + random.choice([-2, -1, 0, 1, 2])
        spo2 = round(random.uniform(97.5, 99.0), 1)
        temp_c = round(36.5 + random.uniform(0.1, 0.3), 2)

        vitals_payload = {
            "device_uid": DEVICE_UID,
            "patient_id": PATIENT_ID,
            "ecg_heart_rate": ecg_hr,
            "max30102_pulse_rate": max30102_pr,
            "spo2": spo2,
            "ir_temperature": temp_c,
            "ecg_lead_status": "normal",
            "ppg_finger_detected": 1,
            "battery_level": 92,
            "wifi_rssi": -64,
            "timestamp": start_time
        }

        ecg_batch_payload = {
            "device_uid": DEVICE_UID,
            "patient_id": PATIENT_ID,
            "sample_rate_hz": SAMPLE_RATE_HZ,
            "samples": samples,
            "start_time": start_time,
            "end_time": time.strftime("%Y-%m-%d %H:%M:%S"),
            "lead_name": "Lead-II"
        }

        # Send to HTTP API if local web server is running
        try:
            req = urllib.request.Request(
                API_URL,
                data=json.dumps(vitals_payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {API_KEY}"
                }
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                status_code = resp.getcode()
                print(f"[{time.strftime('%H:%M:%S')}] Cycle #{cycle}: Vitals sent -> HTTP {status_code} | ECG HR: {ecg_hr} | MAX30102 PR: {max30102_pr} | SpO2: {spo2}%")
        except Exception as e:
            print(f"[{time.strftime('%H:%M:%S')}] Cycle #{cycle} Local API: {e} (Simulated values: HR={ecg_hr}, SpO2={spo2}%)")

        time.sleep(BATCH_INTERVAL_SEC)

if __name__ == "__main__":
    try:
        run_simulation()
    except KeyboardInterrupt:
        print("\nSimulator stopped by user.")
