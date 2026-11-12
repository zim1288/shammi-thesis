/**
 * Patient UI Presentation Module
 * Renders patient cards, data table rows, risk indicators, and device statuses
 */

(function(root) {
  const PatientUI = {
    /**
     * Escape HTML characters to prevent XSS injection
     */
    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    /**
     * Generate HTML for a single patient card in the grid view
     */
    renderCard(p) {
      const riskClass = p.risk_status === 'Critical' ? 'tier-critical' : (p.risk_status === 'Caution' ? 'tier-caution' : 'tier-normal');
      const tagClass = p.risk_status === 'Critical' ? 'critical' : (p.risk_status === 'Caution' ? 'caution' : 'normal');
      
      const isOnline = (p.assigned_device?.status === 'online' || p.assigned_device?.is_online === true);
      const dotStateClass = isOnline ? 'online' : 'offline';
      const pillLabel = isOnline ? 'ONLINE' : 'OFFLINE';

      const initials = p.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const vitals = p.latest_vitals || {};
      const hr = vitals.ecg_heart_rate ?? '--';
      const spo2 = vitals.spo2 ? parseFloat(vitals.spo2).toFixed(0) : '--';
      const temp = vitals.ir_temperature ? parseFloat(vitals.ir_temperature).toFixed(1) : '--';

      const deviceUid = p.assigned_device?.device_uid || 'ESP32-NODE';
      const deviceRssi = p.assigned_device?.wifi_rssi;
      const deviceBatt = p.assigned_device?.battery_level;

      return `
        <div class="patient-roster-card ${riskClass}" id="patient-card-${encodeURIComponent(p.id)}">
          <div>
            <!-- Top Row: Patient Info + Risk Tag + Delete Action -->
            <div class="roster-card-header">
              <div class="patient-title-group">
                <div class="avatar-badge">${initials}</div>
                <div>
                  <h3 class="patient-name-text">${this.escapeHtml(p.full_name)}</h3>
                  <div class="patient-sub-meta">${p.age} Yrs • ${p.gender} • #${p.patient_code}</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="risk-tag ${tagClass}">
                  <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block"></span>
                  ${p.risk_status}
                </span>
                <button type="button" class="btn-delete-patient" 
                  data-id="${encodeURIComponent(p.id)}" 
                  data-name="${this.escapeHtml(p.full_name)}" 
                  data-code="${this.escapeHtml(p.patient_code)}" 
                  data-device="${this.escapeHtml(deviceUid)}" 
                  title="Discharge & Delete Patient">
                  <i class="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>

            <!-- Originating Ward & Decongested Bed -->
            <div style="font-size: 12px; color: #a5b4fc; margin-bottom: 8px;">
              <i class="ri-hotel-bed-line"></i> Origin: <strong>${this.escapeHtml(p.ward_origin)}</strong>
            </div>

            <!-- Dynamic Hardware Node Association Strip (Green = Online, Red = Offline) -->
            <div class="device-pairing-strip">
              <span style="display:flex; align-items:center; gap:8px;">
                <span class="device-status-dot ${dotStateClass}"></span>
                <strong>${this.escapeHtml(deviceUid)}</strong>
                <span class="device-status-pill ${dotStateClass}">${pillLabel}</span>
              </span>
              <span style="color:var(--text-muted); font-size:11px;">
                ${isOnline && deviceRssi !== null
                  ? `<i class="ri-wifi-line" style="color:#10b981;"></i> ${deviceRssi} dBm &nbsp;|&nbsp; <i class="ri-battery-charge-line" style="color:#38bdf8;"></i> ${deviceBatt}%`
                  : `<span style="color:#94a3b8;"><i class="ri-wifi-off-line" style="color:#f87171; margin-right:2px;"></i> Disconnected</span>`
                }
              </span>
            </div>

            <!-- Mini Vitals Live Snapshot -->
            <div class="roster-vitals-strip">
              <div class="roster-vital-cell">
                <div class="roster-vital-title">ECG HR</div>
                <div class="roster-vital-val" style="color:#10b981;">${hr} <span style="font-size:10px;">BPM</span></div>
              </div>
              <div class="roster-vital-cell">
                <div class="roster-vital-title">SpO₂</div>
                <div class="roster-vital-val" style="color:#38bdf8;">${spo2} <span style="font-size:10px;">%</span></div>
              </div>
              <div class="roster-vital-cell">
                <div class="roster-vital-title">Skin Temp</div>
                <div class="roster-vital-val" style="color:#f59e0b;">${temp} <span style="font-size:10px;">°C</span></div>
              </div>
            </div>

            <!-- Clinical Notes Snippet -->
            <p style="font-size: 11px; color: var(--text-dim); line-height: 1.4; margin-bottom: 14px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
              ${this.escapeHtml(p.medical_notes || 'Home telemetry ongoing.')}
            </p>
          </div>

          <!-- Click Through Action -->
          <a href="index.html?patient_id=${encodeURIComponent(p.id)}" class="patient-action-btn">
            <i class="ri-pulse-line"></i>
            <span>Open Dedicated Telemetry →</span>
          </a>
        </div>
      `;
    },

    /**
     * Generate HTML for a single row in the patient data table
     */
    renderTableRow(p) {
      const tagClass = p.risk_status === 'Critical' ? 'critical' : (p.risk_status === 'Caution' ? 'caution' : 'normal');
      const isOnline = (p.assigned_device?.status === 'online' || p.assigned_device?.is_online === true);
      const dotStateClass = isOnline ? 'online' : 'offline';
      const pillLabel = isOnline ? 'ONLINE' : 'OFFLINE';

      const vitals = p.latest_vitals || {};
      const hr = vitals.ecg_heart_rate ?? '--';
      const spo2 = vitals.spo2 ? parseFloat(vitals.spo2).toFixed(0) + '%' : '--';
      const deviceUid = p.assigned_device?.device_uid || 'ESP32-NODE';

      return `
        <tr id="patient-row-${encodeURIComponent(p.id)}">
          <td>
            <span class="risk-tag ${tagClass}">
              <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block"></span>
              ${p.risk_status}
            </span>
          </td>
          <td>
            <div style="font-weight:700; color:#fff;">${this.escapeHtml(p.full_name)}</div>
            <div style="font-size:11px; color:var(--text-muted); font-family:'JetBrains Mono',monospace;">#${p.patient_code} • ${p.age} Yrs (${p.gender})</div>
          </td>
          <td>
            <div style="color:#e0e7ff; font-weight:500;">${this.escapeHtml(p.ward_origin)}</div>
            <div style="font-size:11px; color:var(--text-dim);">Post-acute Decongested</div>
          </td>
          <td style="font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--text-muted);">
            ${p.discharge_date}
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:6px; font-family:'JetBrains Mono',monospace; font-size:12px;">
              <span class="device-status-dot ${dotStateClass}"></span>
              <strong>${this.escapeHtml(deviceUid)}</strong>
              <span class="device-status-pill ${dotStateClass}">${pillLabel}</span>
            </div>
            <div style="font-size:10px; color:var(--text-dim); font-family:'JetBrains Mono',monospace; margin-top:3px;">
              ${isOnline && p.assigned_device?.wifi_rssi !== null
                ? `WiFi: ${p.assigned_device.wifi_rssi} dBm | Batt: ${p.assigned_device.battery_level}%`
                : 'MAC: ' + this.escapeHtml(p.assigned_device?.device_mac || 'N/A')
              }
            </div>
          </td>
          <td>
            <span style="color:#10b981; font-weight:700; font-family:'JetBrains Mono',monospace;">${hr} BPM</span>
            <span style="color:#94a3b8; margin: 0 4px;">•</span>
            <span style="color:#38bdf8; font-weight:700; font-family:'JetBrains Mono',monospace;">${spo2}</span>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <a href="index.html?patient_id=${encodeURIComponent(p.id)}" class="nav-btn primary" style="padding:6px 12px; font-size:12px;">
                <i class="ri-pulse-line"></i>
                <span>Monitor</span>
              </a>
              <button type="button" class="btn-delete-patient" 
                data-id="${encodeURIComponent(p.id)}" 
                data-name="${this.escapeHtml(p.full_name)}" 
                data-code="${this.escapeHtml(p.patient_code)}" 
                data-device="${this.escapeHtml(deviceUid)}" 
                title="Discharge & Delete Patient">
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }
  };

  root.PatientUI = PatientUI;
})(typeof window !== 'undefined' ? window : this);
