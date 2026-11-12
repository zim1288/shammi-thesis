/**
 * Central Doctor Dashboard — Patient Directory & Device Pairing Controller
 * ESP32 Home Patient Monitoring System
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM References
  const patientCardsGrid  = document.getElementById('patientCardsGrid');
  const patientTableWrap  = document.getElementById('patientTableWrap');
  const patientTableBody  = document.getElementById('patientTableBody');

  const statTotalMonitored= document.getElementById('statTotalMonitored');
  const statBedsFreed     = document.getElementById('statBedsFreed');
  const statRiskTiers     = document.getElementById('statRiskTiers');
  const statActiveNodes   = document.getElementById('statActiveNodes');
  const kpiTopDecongested = document.getElementById('kpiTopDecongested');
  const kpiTopNodes       = document.getElementById('kpiTopNodes');
  const badgeActiveAlerts = document.getElementById('badgeActiveAlerts');

  const searchInput       = document.getElementById('patientSearchInput');
  const wardFilter        = document.getElementById('wardOriginFilter');
  const filterChips       = document.querySelectorAll('.filter-chip');

  const btnViewCards      = document.getElementById('btnViewCards');
  const btnViewTable      = document.getElementById('btnViewTable');

  // Modal References: Add Patient
  const modalAddPatient   = document.getElementById('modalAddPatient');
  const btnOpenAddModal   = document.getElementById('btnOpenAddModal');
  const btnNavOpenAddModal= document.getElementById('btnNavOpenAddModal');
  const btnCloseAddModal  = document.getElementById('btnCloseAddModal');
  const btnCancelAddModal = document.getElementById('btnCancelAddModal');
  const formAddPatient    = document.getElementById('formAddPatient');

  // Modal References: Delete Patient
  const modalDeletePatient   = document.getElementById('modalDeletePatient');
  const btnCloseDeleteModal  = document.getElementById('btnCloseDeleteModal');
  const btnCancelDeleteModal = document.getElementById('btnCancelDeleteModal');
  const btnConfirmDelete     = document.getElementById('btnConfirmDelete');
  const deletePatientName    = document.getElementById('deletePatientName');
  const deletePatientCode    = document.getElementById('deletePatientCode');
  const deleteDeviceUid      = document.getElementById('deleteDeviceUid');

  // State
  let allPatients = [];
  let currentRiskFilter = 'all';
  let currentWardFilter = '';
  let currentSearchQuery = '';
  let currentViewMode = 'cards'; // 'cards' | 'table'
  let currentCsrfToken = '';
  let patientToDelete = null;

  // =========================================================================
  // 1. FETCH ACTIVE ROSTER FROM API
  // =========================================================================
  async function loadPatientRoster() {
    try {
      const res = await fetch('../api/patients/list.php');
      if (!res.ok) throw new Error('Network error');
      const json = await res.json();
      
      if (json.success && json.data) {
        allPatients = json.data.patients || [];
        updateKpiStats(json.data.stats || {});
        renderRoster();
      }
    } catch (err) {
      console.warn('Failed to refresh roster:', err);
      if (!allPatients || allPatients.length === 0) {
        patientCardsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #f87171;">
            <i class="ri-error-warning-line" style="font-size: 32px;"></i>
            <p style="margin-top: 10px;">Failed to connect to patient directory. Please check server.</p>
          </div>
        `;
      }
    }
  }

  // Update Executive KPIs
  function updateKpiStats(stats) {
    const total = stats.total_monitored ?? allPatients.length;
    if (statTotalMonitored) statTotalMonitored.innerText = total;
    if (statBedsFreed) statBedsFreed.innerText = `${stats.beds_decongested ?? total} Beds`;
    if (kpiTopDecongested) kpiTopDecongested.innerText = `${stats.beds_decongested ?? total} Freed`;
    
    const crit = stats.critical_count ?? 0;
    const warn = stats.caution_count ?? 0;
    if (statRiskTiers) statRiskTiers.innerText = `${crit} Crit • ${warn} Warn`;
    if (badgeActiveAlerts) badgeActiveAlerts.innerText = crit + warn;
    
    const online = stats.devices_online ?? 0;
    if (statActiveNodes) statActiveNodes.innerText = `${online} / ${total}`;
    if (kpiTopNodes) kpiTopNodes.innerText = `${online} Online`;
  }

  // =========================================================================
  // 2. RENDER ACTIVE DIRECTORY (Cards & Table)
  // =========================================================================
  function renderRoster() {
    const filtered = allPatients.filter(p => {
      // Risk filter
      if (currentRiskFilter !== 'all' && p.risk_status.toLowerCase() !== currentRiskFilter.toLowerCase()) {
        return false;
      }
      // Ward filter
      if (currentWardFilter && !p.ward_origin.toLowerCase().includes(currentWardFilter.toLowerCase())) {
        return false;
      }
      // Search query
      if (currentSearchQuery) {
        const devUid = p.assigned_device?.device_uid || '';
        const str = `${p.full_name} ${p.patient_code} ${devUid} ${p.ward_origin}`.toLowerCase();
        if (!str.includes(currentSearchQuery)) return false;
      }
      return true;
    });

    if (currentViewMode === 'cards') {
      renderCards(filtered);
    } else {
      renderTable(filtered);
    }
  }

  // Render Grid Cards
  function renderCards(patients) {
    patientCardsGrid.style.display = 'grid';
    patientTableWrap.classList.remove('active');

    if (patients.length === 0) {
      patientCardsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-dim);">
          <i class="ri-user-unfollow-line" style="font-size: 32px;"></i>
          <p style="margin-top: 10px;">No patients match your search or filter criteria.</p>
        </div>
      `;
      return;
    }

    patientCardsGrid.innerHTML = patients.map(p => {
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
                  <h3 class="patient-name-text">${escapeHtml(p.full_name)}</h3>
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
                  data-name="${escapeHtml(p.full_name)}" 
                  data-code="${escapeHtml(p.patient_code)}" 
                  data-device="${escapeHtml(deviceUid)}" 
                  title="Discharge & Delete Patient">
                  <i class="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>

            <!-- Originating Ward & Decongested Bed -->
            <div style="font-size: 12px; color: #a5b4fc; margin-bottom: 8px;">
              <i class="ri-hotel-bed-line"></i> Origin: <strong>${escapeHtml(p.ward_origin)}</strong>
            </div>

            <!-- Dynamic Hardware Node Association Strip (Green = Online, Red = Offline) -->
            <div class="device-pairing-strip">
              <span style="display:flex; align-items:center; gap:8px;">
                <span class="device-status-dot ${dotStateClass}"></span>
                <strong>${escapeHtml(deviceUid)}</strong>
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
              ${escapeHtml(p.medical_notes || 'Home telemetry ongoing.')}
            </p>
          </div>

          <!-- Click Through Action -->
          <a href="index.html?patient_id=${encodeURIComponent(p.id)}" class="patient-action-btn">
            <i class="ri-pulse-line"></i>
            <span>Open Dedicated Telemetry →</span>
          </a>
        </div>
      `;
    }).join('');

    bindDeleteButtons();
  }

  // Render Data Table
  function renderTable(patients) {
    patientCardsGrid.style.display = 'none';
    patientTableWrap.classList.add('active');

    if (patients.length === 0) {
      patientTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">
            No patients match your search or filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    patientTableBody.innerHTML = patients.map(p => {
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
            <div style="font-weight:700; color:#fff;">${escapeHtml(p.full_name)}</div>
            <div style="font-size:11px; color:var(--text-muted); font-family:'JetBrains Mono',monospace;">#${p.patient_code} • ${p.age} Yrs (${p.gender})</div>
          </td>
          <td>
            <div style="color:#e0e7ff; font-weight:500;">${escapeHtml(p.ward_origin)}</div>
            <div style="font-size:11px; color:var(--text-dim);">Post-acute Decongested</div>
          </td>
          <td style="font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--text-muted);">
            ${p.discharge_date}
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:6px; font-family:'JetBrains Mono',monospace; font-size:12px;">
              <span class="device-status-dot ${dotStateClass}"></span>
              <strong>${escapeHtml(deviceUid)}</strong>
              <span class="device-status-pill ${dotStateClass}">${pillLabel}</span>
            </div>
            <div style="font-size:10px; color:var(--text-dim); font-family:'JetBrains Mono',monospace; margin-top:3px;">
              ${isOnline && p.assigned_device?.wifi_rssi !== null
                ? `WiFi: ${p.assigned_device.wifi_rssi} dBm | Batt: ${p.assigned_device.battery_level}%`
                : 'MAC: ' + escapeHtml(p.assigned_device?.device_mac || 'N/A')
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
                data-name="${escapeHtml(p.full_name)}" 
                data-code="${escapeHtml(p.patient_code)}" 
                data-device="${escapeHtml(deviceUid)}" 
                title="Discharge & Delete Patient">
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    bindDeleteButtons();
  }

  // =========================================================================
  // 3. DELETE PATIENT CONFIRMATION & EXECUTION
  // =========================================================================
  function bindDeleteButtons() {
    document.querySelectorAll('.btn-delete-patient').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const id = decodeURIComponent(btn.getAttribute('data-id'));
        const name = btn.getAttribute('data-name');
        const code = btn.getAttribute('data-code');
        const device = btn.getAttribute('data-device');

        openDeleteModal({ id, name, code, device });
      });
    });
  }

  function openDeleteModal(patient) {
    patientToDelete = patient;
    if (deletePatientName) deletePatientName.textContent = patient.name;
    if (deletePatientCode) deletePatientCode.textContent = '#' + patient.code;
    if (deleteDeviceUid) deleteDeviceUid.textContent = patient.device;
    if (modalDeletePatient) modalDeletePatient.classList.add('active');
  }

  function closeDeleteModal() {
    patientToDelete = null;
    if (modalDeletePatient) modalDeletePatient.classList.remove('active');
  }

  if (btnCloseDeleteModal)  btnCloseDeleteModal.addEventListener('click', closeDeleteModal);
  if (btnCancelDeleteModal) btnCancelDeleteModal.addEventListener('click', closeDeleteModal);

  if (modalDeletePatient) {
    modalDeletePatient.addEventListener('click', (e) => {
      if (e.target === modalDeletePatient) closeDeleteModal();
    });
  }

  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
      if (!patientToDelete) return;

      const pId = patientToDelete.id;
      const pName = patientToDelete.name;

      btnConfirmDelete.disabled = true;
      btnConfirmDelete.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i> Removing...';

      try {
        const res = await fetch('../api/patients/delete.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': currentCsrfToken
          },
          body: JSON.stringify({ patient_id: pId })
        });

        const json = await res.json();

        if (res.ok && json.success) {
          closeDeleteModal();
          // Remove patient from local array immediately
          allPatients = allPatients.filter(p => p.id !== pId && p.patient_code !== pId);
          renderRoster();
          // Refresh full roster & stats from backend
          await loadPatientRoster();
        } else {
          alert('Failed to remove patient: ' + (json.message || 'Server error'));
        }
      } catch (err) {
        alert('Network communication error while removing patient.');
      } finally {
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.innerHTML = '<i class="ri-delete-bin-7-line"></i> <span>Confirm Delete</span>';
      }
    });
  }

  // =========================================================================
  // 4. SEARCH & FILTER EVENT HANDLERS
  // =========================================================================
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.toLowerCase().trim();
      renderRoster();
    });
  }

  if (wardFilter) {
    wardFilter.addEventListener('change', (e) => {
      currentWardFilter = e.target.value.trim();
      renderRoster();
    });
  }

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentRiskFilter = chip.getAttribute('data-filter') || 'all';
      renderRoster();
    });
  });

  if (btnViewCards && btnViewTable) {
    btnViewCards.addEventListener('click', () => {
      currentViewMode = 'cards';
      btnViewCards.classList.add('active');
      btnViewTable.classList.remove('active');
      renderRoster();
    });

    btnViewTable.addEventListener('click', () => {
      currentViewMode = 'table';
      btnViewTable.classList.add('active');
      btnViewCards.classList.remove('active');
      renderRoster();
    });
  }

  // =========================================================================
  // 5. ADD PATIENT MODAL HANDLERS
  // =========================================================================
  function openAddModal() {
    if (modalAddPatient) {
      modalAddPatient.classList.add('active');
      // Fetch fresh CSRF token
      fetch('../api/auth/csrf.php')
        .then(r => r.json())
        .then(d => { if (d && d.data && d.data.csrf_token) currentCsrfToken = d.data.csrf_token; })
        .catch(() => {});

      // Autofill default unique node UID suggestion
      const uidInput = document.getElementById('inputDeviceUid');
      if (uidInput && !uidInput.value) {
        uidInput.value = 'ESP32-NODE-0' + (allPatients.length + 1);
      }
      const macInput = document.getElementById('inputDeviceMac');
      if (macInput && !macInput.value) {
        macInput.value = '24:6F:28:' + Math.floor(10 + Math.random() * 89) + ':' + Math.floor(10 + Math.random() * 89) + ':' + Math.floor(10 + Math.random() * 89);
      }
    }
  }

  function closeAddModal() {
    if (modalAddPatient) {
      modalAddPatient.classList.remove('active');
      if (formAddPatient) formAddPatient.reset();
    }
  }

  if (btnOpenAddModal)    btnOpenAddModal.addEventListener('click', openAddModal);
  if (btnNavOpenAddModal) btnNavOpenAddModal.addEventListener('click', openAddModal);
  if (btnCloseAddModal)   btnCloseAddModal.addEventListener('click', closeAddModal);
  if (btnCancelAddModal)  btnCancelAddModal.addEventListener('click', closeAddModal);

  // Auto open modal if navigated with ?open_add=1
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('open_add') === '1' || urlParams.get('add') === 'true') {
    setTimeout(openAddModal, 250);
  }

  if (modalAddPatient) {
    modalAddPatient.addEventListener('click', (e) => {
      if (e.target === modalAddPatient) closeAddModal();
    });
  }

  // Handle Form Submission (Add Patient & Pair Hardware)
  if (formAddPatient) {
    formAddPatient.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = formAddPatient.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i> Provisioning Device...';
      submitBtn.disabled = true;

      const payload = {
        full_name: document.getElementById('inputFullName').value.trim(),
        age: document.getElementById('inputAge').value,
        gender: document.getElementById('inputGender').value,
        phone: document.getElementById('inputPhone').value.trim(),
        ward_origin: document.getElementById('inputWard').value,
        device_uid: document.getElementById('inputDeviceUid').value.trim(),
        device_mac: document.getElementById('inputDeviceMac').value.trim(),
        hr_min: document.getElementById('inputHrMin').value,
        hr_max: document.getElementById('inputHrMax').value,
        spo2_min: document.getElementById('inputSpo2Min').value,
        medical_notes: document.getElementById('inputMedicalNotes').value.trim()
      };

      try {
        const res = await fetch('../api/patients/create.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': currentCsrfToken
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
          closeAddModal();
          await loadPatientRoster();
          
          const newId = data.data?.patient?.id;
          if (confirm(`Patient ${payload.full_name} successfully discharged and paired with ${payload.device_uid}!\n\nWould you like to open their Dedicated Telemetry HUD now?`)) {
            window.location.href = `index.html?patient_id=${encodeURIComponent(newId)}`;
          }
        } else {
          alert('Failed to onboard patient: ' + (data.message || 'Unknown error'));
        }
      } catch (err) {
        alert('Network error while saving patient and device.');
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
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

  // Initial Load & Real-Time Polling Interval (Every 5 seconds)
  loadPatientRoster();
  setInterval(loadPatientRoster, 5000);
});
