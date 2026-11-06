<?php
namespace App\Services;

require_once __DIR__ . '/../Repositories/AlertRepository.php';

use App\Repositories\AlertRepository;

/**
 * Medical & Physiological Alert Engine Service
 */
class AlertEngineService {
    private AlertRepository $alertRepo;
    private array $thresholds;

    public function __construct() {
        $this->alertRepo = new AlertRepository();
        $this->thresholds = require __DIR__ . '/../../config/thresholds.php';
    }

    public function evaluateAndLog(string $patientId, string $deviceUid, array $vitals): int {
        $generatedAlerts = [];

        // 1. ECG Electrode Contact (Lead-Off Detection)
        $leadStatus = $vitals['ecg_lead_status'] ?? 'normal';
        if ($leadStatus !== 'normal') {
            $generatedAlerts[] = [
                'alert_type' => 'lead_off',
                'severity'   => 'warning',
                'message'    => "ECG Electrode Detached ({$leadStatus})",
                'threshold'  => 'normal',
                'actual'     => $leadStatus
            ];
        }

        // 2. Optical Finger Contact
        $finger = isset($vitals['ppg_finger_detected']) ? (int)$vitals['ppg_finger_detected'] : 1;
        if ($finger === 0) {
            $generatedAlerts[] = [
                'alert_type' => 'finger_removed',
                'severity'   => 'info',
                'message'    => 'MAX30102 finger probe disconnected',
                'threshold'  => '1 (present)',
                'actual'     => '0 (removed)'
            ];
        }

        // 3. Heart Rate Thresholds (ECG)
        $hr = isset($vitals['ecg_heart_rate']) ? (int)$vitals['ecg_heart_rate'] : null;
        if ($hr !== null && $leadStatus === 'normal' && $hr > 0) {
            if ($hr > $this->thresholds['ecg_hr_max']) {
                $generatedAlerts[] = [
                    'alert_type' => 'tachycardia',
                    'severity'   => 'critical',
                    'message'    => "High Heart Rate (Tachycardia): {$hr} BPM",
                    'threshold'  => "Max {$this->thresholds['ecg_hr_max']} BPM",
                    'actual'     => "{$hr} BPM"
                ];
            } elseif ($hr < $this->thresholds['ecg_hr_min']) {
                $generatedAlerts[] = [
                    'alert_type' => 'bradycardia',
                    'severity'   => 'critical',
                    'message'    => "Low Heart Rate (Bradycardia): {$hr} BPM",
                    'threshold'  => "Min {$this->thresholds['ecg_hr_min']} BPM",
                    'actual'     => "{$hr} BPM"
                ];
            }
        }

        // 4. Oxygen Saturation (SpO2)
        $spo2 = isset($vitals['spo2']) ? (float)$vitals['spo2'] : null;
        if ($spo2 !== null && $finger === 1 && $spo2 > 0) {
            if ($spo2 < $this->thresholds['spo2_min']) {
                $generatedAlerts[] = [
                    'alert_type' => 'low_spo2',
                    'severity'   => 'critical',
                    'message'    => "Hypoxemia Alert: SpO₂ at {$spo2}%",
                    'threshold'  => "Min {$this->thresholds['spo2_min']}%",
                    'actual'     => "{$spo2}%"
                ];
            }
        }

        // 5. Skin Surface Temperature
        $temp = isset($vitals['ir_temperature']) ? (float)$vitals['ir_temperature'] : null;
        if ($temp !== null && $temp > 0) {
            if ($temp > $this->thresholds['temp_max']) {
                $generatedAlerts[] = [
                    'alert_type' => 'hyperthermia',
                    'severity'   => 'warning',
                    'message'    => "Elevated Surface Temperature: {$temp} °C",
                    'threshold'  => "Max {$this->thresholds['temp_max']} °C",
                    'actual'     => "{$temp} °C"
                ];
            } elseif ($temp < $this->thresholds['temp_min']) {
                $generatedAlerts[] = [
                    'alert_type' => 'hypothermia',
                    'severity'   => 'warning',
                    'message'    => "Low Skin Temperature: {$temp} °C",
                    'threshold'  => "Min {$this->thresholds['temp_min']} °C",
                    'actual'     => "{$temp} °C"
                ];
            }
        }

        // Insert non-duplicate active alerts
        $count = 0;
        foreach ($generatedAlerts as $a) {
            $a['patient_id'] = $patientId;
            $a['device_uid'] = $deviceUid;
            $this->alertRepo->insertAlert($a);
            $count++;
        }

        return $count;
    }
}
