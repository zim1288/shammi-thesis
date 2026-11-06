/**
 * Main Clinical Telemetry Dashboard Controller
 * ESP32 Home Patient Monitoring System
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. URL Query Parameter for Dynamic Patient Routing
  const urlParams = new URLSearchParams(window.location.search);
  const currentPatientId = urlParams.get('patient_id') || APP_CONFIG.defaultPatientId;

  // Initialize ECG Canvas
  const ecgRenderer = new ECGWaveformRenderer('liveEcgCanvas', {
    sweepSpeed: 2.2,
    lineColor: '#10b981',
    lineWidth: 2.0
  });

  // UI Element References
  const elEcgHr          = document.getElementById('valEcgHr');
  const elMax30102Pr     = document.getElementById('valMax30102Pr');
  const elSpo2           = document.getElementById('valSpo2');
  const elTemp           = document.getElementById('valTemp');
  const elTempF          = document.getElementById('valTempF');
  const elBpSys          = document.getElementById('valBpSys');
  const elBpDia          = document.getElementById('valBpDia');
  const elBpMeta         = document.getElementById('valBpMeta');
  const elDeviceStatus   = document.getElementById('badgeDeviceStatus');
  const elDeviceMeta     = document.getElementById('deviceMetaInfo');
  const elEcgLeadStatus  = document.getElementById('statusEcgLead');
  const elPpgFinger      = document.getElementById('statusPpgFinger');
  const elLastUpdate     = document.getElementById('valLastUpdate');
  const elActiveAlerts   = document.getElementById('badgeActiveAlerts');
  const elCommMode       = document.getElementById('commModeBadge');
  const btnPauseEcg      = document.getElementById('btnPauseEcg');

  let lastTimestampSec = 0;
  let updateIntervalTimer = null;
  let currentPatientData = null;

  // 2. Pause / Resume Waveform Handler
  if (btnPauseEcg) {
    btnPauseEcg.addEventListener('click', () => {
      const isPaused = ecgRenderer.togglePause();
      btnPauseEcg.innerText = isPaused ? '▶ Resume Waveform' : '⏸ Pause Waveform';
      btnPauseEcg.classList.toggle('primary', isPaused);
    });
  }

  // 3. Update UI with Telemetry Data
  function updateDashboardUI(data) {
    if (!data) return;

    const vitals  = data.latest_vitals || {};
    const device  = data.device || {};
    const bp      = data.latest_manual_bp || {};
    const patient = data.patient || {};
    currentPatientData = patient;
    window.currentPatientData = patient;

    // Update dynamic CSV link for this patient
    const csvLink = document.getElementById('btnExportCsvLink');
    if (csvLink) csvLink.href = `../api/vitals/history.php?patient_id=${encodeURIComponent(currentPatientId)}&format=csv&limit=500`;

    // Patient Profile Metadata
    const headerPatientTag = document.getElementById('headerPatientTag');
    if (headerPatientTag && patient.full_name) {
      headerPatientTag.innerHTML = `<span>PATIENT: <strong>${patient.full_name.toUpperCase()} (${patient.patient_code || patient.id})</strong></span> <span>•</span> <span>ORIGIN: <strong>${(patient.ward_origin || 'ICU Step-Down').toUpperCase()}</strong></span>`;
    }
    const profileName = document.getElementById('profilePatientName');
    if (profileName && patient.full_name) profileName.innerText = patient.full_name;
    const profileCode = document.getElementById('profilePatientCode');
    if (profileCode) profileCode.innerText = '#' + (patient.patient_code || patient.id || currentPatientId);
    const profileMeta = document.getElementById('profilePatientMeta');
    if (profileMeta && patient.age) profileMeta.innerHTML = `<i class="ri-user-line" style="color: #818cf8;"></i> ${patient.age} Yrs • ${patient.gender || 'N/A'}`;
    const profileWard = document.getElementById('profilePatientWard');
    if (profileWard) profileWard.innerHTML = `<i class="ri-hotel-bed-line" style="color: #38bdf8;"></i> Ward: ${patient.ward_origin || 'Discharged Home'}`;
    const profileRoom = document.getElementById('profilePatientRoom');
    if (profileRoom) profileRoom.innerHTML = `<i class="ri-map-pin-2-line" style="color: #06b6d4;"></i> ${patient.room_bed || 'Bed Unassigned'}`;
    const profileDev = document.getElementById('profilePatientDevice');
    if (profileDev) profileDev.innerHTML = `<i class="ri-cpu-line" style="color: #a5b4fc;"></i> Paired Node: ${patient.assigned_device_uid || device.device_uid || 'ESP32-NODE-01'}`;
    const profileNotes = document.getElementById('profilePatientNotes');
    if (profileNotes && patient.medical_notes) profileNotes.innerText = patient.medical_notes;
    const profileRisk = document.getElementById('profilePatientRiskBadge');
    if (profileRisk) {
      const risk = (patient.risk_status || 'Normal').toUpperCase();
      const isCrit = risk === 'CRITICAL';
      const isWarn = risk === 'CAUTION';
      profileRisk.style.background = isCrit ? 'rgba(239,68,68,0.15)' : (isWarn ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)');
      profileRisk.style.color = isCrit ? '#f87171' : (isWarn ? '#fbbf24' : '#34d399');
      profileRisk.style.borderColor = isCrit ? 'rgba(239,68,68,0.3)' : (isWarn ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)');
      profileRisk.innerHTML = `● ${risk}`;
    }

    const logSub = document.getElementById('patientManualLogSubtitle');
    if (logSub && patient.full_name) {
      logSub.innerText = `Audit-trailed physical measurements and bedside observations for ${patient.full_name} (#${patient.patient_code || currentPatientId})`;
    }

    const profileAvatar = document.getElementById('profilePatientAvatar');
    if (profileAvatar && patient.full_name) {
      const parts = patient.full_name.trim().split(' ');
      const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
      profileAvatar.innerText = initials;
    }

    // Dynamic Clinical Baseline Safeguards
    const thresh = patient.baseline_thresholds || {};
    const hrRangeEl = document.getElementById('thresholdHrRange');
    if (hrRangeEl && thresh.hr_min && thresh.hr_max) hrRangeEl.innerText = `${thresh.hr_min} - ${thresh.hr_max} BPM`;
    const spo2FloorEl = document.getElementById('thresholdSpo2Floor');
    if (spo2FloorEl && thresh.spo2_min) spo2FloorEl.innerText = `Min ${thresh.spo2_min}% Saturation`;
    const tempCeilEl = document.getElementById('thresholdTempCeil');
    if (tempCeilEl && thresh.temp_max) tempCeilEl.innerText = `Max ${thresh.temp_max} °C`;

    // A. Separate Heart Rates
    if (vitals.ecg_heart_rate !== null && vitals.ecg_heart_rate !== undefined) {
      elEcgHr.innerText = vitals.ecg_heart_rate;
    }
    if (vitals.max30102_pulse_rate !== null && vitals.max30102_pulse_rate !== undefined) {
      elMax30102Pr.innerText = vitals.max30102_pulse_rate;
    }

    // B. SpO2 and Temperature
    if (vitals.spo2 !== null && vitals.spo2 !== undefined) {
      elSpo2.innerText = parseFloat(vitals.spo2).toFixed(0);
    }
    if (vitals.ir_temperature !== null && vitals.ir_temperature !== undefined) {
      const c = parseFloat(vitals.ir_temperature);
      elTemp.innerText = c.toFixed(1);
      elTempF.innerText = ((c * 9/5) + 32).toFixed(1) + ' °F';
    }

    // C. Manual Blood Pressure (Separated from automated vitals)
    if (bp.systolic_bp && bp.diastolic_bp) {
      elBpSys.innerText = bp.systolic_bp;
      elBpDia.innerText = bp.diastolic_bp;
      const recTime = bp.measurement_timestamp ? new Date(bp.measurement_timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A';
      elBpMeta.innerText = `Manual Entry • ${recTime} • By: ${bp.recorded_by || bp.recorded_by_name || 'Staff'}`;
    }

    // D. Device Connection Status
    const isOnline = (device.status === 'online');
    elDeviceStatus.className = 'status-badge ' + (isOnline ? 'status-online' : 'status-offline');
    elDeviceStatus.innerHTML = isOnline 
      ? '<span style="width:7px;height:7px;border-radius:50%;background:#34d399;display:inline-block"></span> ESP32 ONLINE'
      : '<span style="width:7px;height:7px;border-radius:50%;background:#f87171;display:inline-block"></span> ESP32 OFFLINE';

    elDeviceMeta.innerText = `ID: ${device.device_uid || 'ESP32-NODE-01'} | RSSI: ${device.wifi_rssi || -64} dBm | Batt: ${device.battery_level || 92}%`;

    // E. Sensor Contact & Validity Flags
    const leadNormal = (vitals.ecg_lead_status === 'normal');
    elEcgLeadStatus.innerHTML = leadNormal
      ? '<span style="color:#10b981">● LO-/LO+ Normal</span>'
      : '<span style="color:#f87171;font-weight:bold">▲ Lead-Off Detached</span>';
    ecgRenderer.setLeadStatus(leadNormal);

    const fingerPresent = (vitals.ppg_finger_detected == 1);
    elPpgFinger.innerHTML = fingerPresent
      ? '<span style="color:#06b6d4">● Finger Detected</span>'
      : '<span style="color:#f59e0b;font-weight:bold">▲ Finger Removed</span>';

    // F. Active Alerts Count
    const alertCount = data.active_alerts_count || 0;
    elActiveAlerts.innerText = alertCount;
    elActiveAlerts.style.background = alertCount > 0 ? '#ef4444' : '#10b981';

    // G. Reset Last Update Counter
    lastTimestampSec = 0;
    elLastUpdate.innerText = 'Just now';
  }

  // 4. Time Since Last Update Incrementer
  setInterval(() => {
    lastTimestampSec += 1;
    if (lastTimestampSec < 60) {
      elLastUpdate.innerText = `${lastTimestampSec}s ago`;
    } else {
      const mins = Math.floor(lastTimestampSec / 60);
      elLastUpdate.innerText = `${mins}m ago`;
    }
  }, 1000);

  // 5. REST API Polling (Guaranteed to work on all cPanel environments)
  async function fetchLatestTelemetry() {
    try {
      const res = await fetch(`${APP_CONFIG.api.vitalsLatest}?patient_id=${encodeURIComponent(currentPatientId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          updateDashboardUI(json.data);
        }
      }
    } catch (err) {
      console.warn('Telemetry polling error:', err);
    }
  }

  // 6. Fetch Latest Recorded ECG Batch on startup
  async function fetchInitialEcgBatch() {
    try {
      const res = await fetch(`${APP_CONFIG.api.ecgLatest}?patient_id=${encodeURIComponent(currentPatientId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && Array.isArray(json.data.samples)) {
          ecgRenderer.pushSamples(json.data.samples);
        }
      }
    } catch (e) {
      console.log('Using simulated ECG baseline.');
    }
  }

  // 7. MQTT over WebSocket Client Setup
  function initMqttClient() {
    if (!APP_CONFIG.mqtt.enabled || typeof Paho === 'undefined') {
      elCommMode.innerText = 'REST API Polling (Active)';
      return;
    }

    try {
      const client = new Paho.MQTT.Client(
        APP_CONFIG.mqtt.host,
        Number(APP_CONFIG.mqtt.port),
        APP_CONFIG.mqtt.path,
        APP_CONFIG.mqtt.clientIdPrefix
      );

      client.onConnectionLost = (responseObject) => {
        elCommMode.innerText = 'REST Polling (MQTT Reconnecting...)';
        setTimeout(initMqttClient, 5000);
      };

      client.onMessageArrived = (message) => {
        try {
          const topic = message.destinationName;
          const payload = JSON.parse(message.payloadString);

          // ECG Waveform Topic
          if (topic === APP_CONFIG.mqtt.topics.ecg && Array.isArray(payload.samples)) {
            ecgRenderer.pushSamples(payload.samples);
          }
          // Consolidated Vitals Topic
          else if (topic === APP_CONFIG.mqtt.topics.vitals) {
            updateDashboardUI({
              latest_vitals: payload,
              device: { status: 'online', wifi_rssi: payload.wifi_rssi, battery_level: payload.battery_level },
              latest_manual_bp: null,
              active_alerts_count: payload.active_alerts || 0
            });
          }
        } catch (parseErr) {
          console.error('MQTT payload parse error:', parseErr);
        }
      };

      const connectOptions = {
        useSSL: APP_CONFIG.mqtt.useSSL,
        timeout: 5,
        onSuccess: () => {
          elCommMode.innerText = 'MQTT WebSocket (Live)';
          elCommMode.style.color = '#34d399';
          client.subscribe(APP_CONFIG.mqtt.topics.ecg);
          client.subscribe(APP_CONFIG.mqtt.topics.vitals);
          client.subscribe(APP_CONFIG.mqtt.topics.status);
          client.subscribe(APP_CONFIG.mqtt.topics.alerts);
        },
        onFailure: () => {
          elCommMode.innerText = 'REST Polling (Active)';
        }
      };

      client.connect(connectOptions);
    } catch (err) {
      console.warn('MQTT init skipped or failed:', err);
      elCommMode.innerText = 'REST Polling (Active)';
    }
  }

  // Start Services
  fetchInitialEcgBatch();
  fetchLatestTelemetry();
  loadPatientManualLogs();
  initMqttClient();

  // Run periodic fallback poll every 2.5 seconds
  setInterval(fetchLatestTelemetry, APP_CONFIG.pollingIntervalMs);

  // =========================================================================
  // 8. SCOPED MANUAL BLOOD PRESSURE LISTENER (Driven by manual_bp_modal.js)
  // =========================================================================
  window.addEventListener('manualBpSaved', (e) => {
    const d = e.detail || {};
    if (elBpSys && d.systolic_bp) elBpSys.innerText = d.systolic_bp;
    if (elBpDia && d.diastolic_bp) elBpDia.innerText = d.diastolic_bp;
    const formattedEntryTime = d.measurement_timestamp 
      ? new Date(d.measurement_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      : 'Just now';
    if (elBpMeta) {
      elBpMeta.innerText = `Manual Entry • ${formattedEntryTime} • By: ${d.recorded_by || 'Staff'}`;
    }
    loadPatientManualLogs();
  });

  // =========================================================================
  // 9. PATIENT MANUAL CLINICAL LOGS (Audit History Table)
  // =========================================================================
  const patientManualLogTableBody = document.getElementById('patientManualLogTableBody');
  const patientManualLogSubtitle  = document.getElementById('patientManualLogSubtitle');

  async function loadPatientManualLogs() {
    if (!patientManualLogTableBody) return;
    try {
      const res = await fetch(`${APP_CONFIG.api.manualBpList}?patient_id=${encodeURIComponent(currentPatientId)}&limit=30`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          renderPatientManualLogs(json.data.records || []);
        }
      }
    } catch (err) {
      console.error('Failed to load manual clinical logs:', err);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderPatientManualLogs(records) {
    if (!patientManualLogTableBody) return;
    if (patientManualLogSubtitle && currentPatientData) {
      patientManualLogSubtitle.innerText = `Audit-trailed physical measurements and bedside observations for ${currentPatientData.full_name || 'Active Patient'} (#${currentPatientData.patient_code || currentPatientId})`;
    }

    if (!records.length) {
      patientManualLogTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 24px; text-align: center; color: #64748b;">
            <i class="ri-information-line"></i> No manual clinical entries recorded yet for this patient. Click <strong>Manual BP Entry</strong> to record the first measurement.
          </td>
        </tr>
      `;
      return;
    }

    patientManualLogTableBody.innerHTML = records.map(r => {
      const rawTime = r.measurement_timestamp || r.created_at || '';
      const formattedTime = (rawTime && !isNaN(Date.parse(rawTime)))
        ? new Date(rawTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : (rawTime || 'Just now');

      const sys = r.systolic_bp;
      const dia = r.diastolic_bp;
      let statusPill = '';
      if (sys > 140 || dia > 90) {
        statusPill = `<span style="background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px;">Stage 2 High</span>`;
      } else if (sys >= 120 || dia >= 80) {
        statusPill = `<span style="background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px;">Elevated</span>`;
      } else {
        statusPill = `<span style="background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px;">Normal</span>`;
      }

      return `
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          <td style="padding: 12px 14px; font-family: 'JetBrains Mono', monospace; color: #cbd5e1;">${formattedTime}</td>
          <td style="padding: 12px 14px; color: #a5b4fc; font-weight: 600;">
            <i class="ri-stethoscope-line"></i> Blood Pressure (NIBP)
          </td>
          <td style="padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: #ffffff;">
            ${sys} / ${dia} <span style="font-size: 11px; font-weight: 400; color: #94a3b8;">mmHg</span>
            <div style="margin-top: 3px;">${statusPill}</div>
          </td>
          <td style="padding: 12px 14px; font-family: 'JetBrains Mono', monospace; color: #38bdf8; font-weight: 600;">
            ${r.pulse_rate ? r.pulse_rate + ' BPM' : '—'}
          </td>
          <td style="padding: 12px 14px; color: #94a3b8; font-size: 12px; max-width: 260px; word-break: break-word;">
            ${escapeHtml(r.notes || 'Routine checkup')}
          </td>
          <td style="padding: 12px 14px; color: #e2e8f0; font-weight: 500;">
            <i class="ri-user-follow-line" style="color: #6366f1;"></i> ${escapeHtml(r.recorded_by || 'Clinician')}
          </td>
          <td style="padding: 12px 14px;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; background: rgba(99,102,241,0.15); color: #a5b4fc; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(99,102,241,0.25);">
              manual_entry
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Floating Toast Notification
  function showLiveToast(msg) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '28px';
    toast.style.right = '28px';
    toast.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(6, 182, 212, 0.95))';
    toast.style.color = '#ffffff';
    toast.style.padding = '12px 22px';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.4)';
    toast.style.fontSize = '13px';
    toast.style.fontWeight = '700';
    toast.style.zIndex = '9999';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.style.transition = 'all 0.3s ease';
    toast.innerHTML = `<i class="ri-checkbox-circle-fill" style="font-size: 18px;"></i> <span>${msg}</span>`;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }
  window.showLiveToast = showLiveToast;
});
