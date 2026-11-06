<?php
/**
 * Physiological Safety Thresholds for Automated Alerts
 * ESP32 Home Patient Monitoring System
 */

return [
    'ecg_hr_min'        => 50,    // Bradycardia threshold (BPM)
    'ecg_hr_max'        => 120,   // Tachycardia threshold (BPM)
    'spo2_min'          => 92.0,  // Critical hypoxia threshold (%)
    'temp_min'          => 35.0,  // Hypothermia (°C)
    'temp_max'          => 38.5,  // Fever/Hyperthermia (°C)
    'bp_systolic_max'   => 140,   // Stage 2 Hypertension (mmHg)
    'bp_systolic_min'   => 90,    // Hypotension (mmHg)
    'bp_diastolic_max'  => 90,    // Stage 2 Diastolic (mmHg)
    'bp_diastolic_min'  => 60     // Low Diastolic (mmHg)
];
