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

  // Modal References
  const modalAddPatient   = document.getElementById('modalAddPatient');
  const btnOpenAddModal   = document.getElementById('btnOpenAddModal');
  const btnNavOpenAddModal= document.getElementById('btnNavOpenAddModal');
  const btnCloseAddModal  = document.getElementById('btnCloseAddModal');
  const btnCancelAddModal = document.getElementById('btnCancelAddModal');
  const formAddPatient    = document.getElementById('formAddPatient');

  // State
  let allPatients = [];
  let currentRiskFilter = 'all';
  let currentWardFilter = '';
  let currentSearchQuery = '';
  let currentViewMode = 'cards'; // 'cards' | 'table'
  let currentCsrfToken = '';

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
      console.error('Failed to load roster:', err);
      patientCardsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #f87171;">
          <i class="ri-error-warning-line" style="font-size: 32px;"></i>
          <p style="margin-top: 10px;">Failed to connect to patient directory. Please check server.</p>
        </div>
      `;
    }
  }

  // Update Executive KPIs
  function updateKpiStats(stats) {
    if (statTotalMonitored) statTotalMonitored.innerText = stats.total_monitored ?? allPatients.length;
    if (statBedsFreed) statBedsFreed.innerText = `${stats.beds_decongested ?? allPatients.length} Beds`;
    if (kpiTopDecongested) kpiTopDecongested.innerText = `${stats.beds_decongested ?? allPatients.length} Freed`;
    
    const crit = stats.critical_count ?? 0;
    const warn = stats.caution_count ?? 0;
    if (statRiskTiers) statRiskTiers.innerText = `${crit} Crit • ${warn} Warn`;
    if (badgeActiveAlerts) badgeActiveAlerts.innerText = crit + warn;
    
    const online = stats.devices_online ?? 0;
    const total = stats.total_monitored ?? allPatients.length;
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
        const str = `${p.full_name} ${p.patient_code} ${p.assigned_device.device_uid} ${p.ward_origin}`.toLowerCase();
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
      const isOnline = (p.assigned_device.status === 'online');
      const dotColor = isOnline ? '#10b981' : '#f87171';

      const initials = p.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const vitals = p.latest_vitals || {};
      const hr = vitals.ecg_heart_rate ?? '--';
      const spo2 = vitals.spo2 ? parseFloat(vitals.spo2).toFixed(0) : '--';
      const temp = vitals.ir_temperature ? parseFloat(vitals.ir_temperature).toFixed(1) : '--';

      return `
        <div class="patient-roster-card ${riskClass}">
          <div>
            <!-- Top Row -->
            <div class="roster-card-header">
              <div class="patient-title-group">
                <div class="avatar-badge">${initials}</div>
                <div>
                  <h3 class="patient-name-text">${escapeHtml(p.full_name)}</h3>
                  <div class="patient-sub-meta">${p.age} Yrs • ${p.gender} • #${p.patient_code}</div>
                </div>
              </div>
              <span class="risk-tag ${tagClass}">
                <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block"></span>
                ${p.risk_status}
              </span>
            </div>

            <!-- Originating Ward & Decongested Bed -->
            <div style="font-size: 12px; color: #a5b4fc; margin-bottom: 8px;">
              <i class="ri-hotel-bed-line"></i> Origin: <strong>${escapeHtml(p.ward_origin)}</strong>
            </div>

            <!-- Hardware Node Association Strip -->
            <div class="device-pairing-strip">
              <span style="display:flex; align-items:center; gap:6px;">
                <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor};display:inline-block"></span>
                <strong>${escapeHtml(p.assigned_device.device_uid)}</strong>
              </span>
              <span style="color:var(--text-muted); font-size:11px;">
                <i class="ri-wifi-line"></i> ${p.assigned_device.wifi_rssi} dBm &nbsp;|&nbsp; 
                <i class="ri-battery-charge-line"></i> ${p.assigned_device.battery_level}%
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
      const isOnline = (p.assigned_device.status === 'online');
      const dotColor = isOnline ? '#10b981' : '#f87171';
      const vitals = p.latest_vitals || {};
      const hr = vitals.ecg_heart_rate ?? '--';
      const spo2 = vitals.spo2 ? parseFloat(vitals.spo2).toFixed(0) + '%' : '--';

      return `
        <tr>
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
              <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor};display:inline-block"></span>
              <strong>${escapeHtml(p.assigned_device.device_uid)}</strong>
            </div>
            <div style="font-size:10px; color:var(--text-dim); font-family:'JetBrains Mono',monospace;">
              MAC: ${escapeHtml(p.assigned_device.device_mac || 'N/A')}
            </div>
          </td>
          <td>
            <span style="color:#10b981; font-weight:700; font-family:'JetBrains Mono',monospace;">${hr} BPM</span>
            <span style="color:#94a3b8; margin: 0 4px;">•</span>
            <span style="color:#38bdf8; font-weight:700; font-family:'JetBrains Mono',monospace;">${spo2}</span>
          </td>
          <td>
            <a href="index.html?patient_id=${encodeURIComponent(p.id)}" class="nav-btn primary" style="padding:6px 12px; font-size:12px;">
              <i class="ri-pulse-line"></i>
              <span>Monitor</span>
            </a>
          </td>
        </tr>
      `;
    }).join('');
  }

  // =========================================================================
  // 3. SEARCH & FILTER EVENT HANDLERS
  // =========================================================================
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.toLowerCase().trim();
      renderRoster();
    });
  }

  if (wardFilter) {
    wardFilter.addEventListener('change', (e) => {
      currentWardFilter = e.target.value;
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

  // View Switcher Handlers
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
  // 4. DEVICE ASSOCIATION MODAL (Discharge Intake Form)
  // =========================================================================
  function openModal() {
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

  function closeModal() {
    if (modalAddPatient) {
      modalAddPatient.classList.remove('active');
      if (formAddPatient) formAddPatient.reset();
    }
  }

  if (btnOpenAddModal)    btnOpenAddModal.addEventListener('click', openModal);
  if (btnNavOpenAddModal) btnNavOpenAddModal.addEventListener('click', openModal);
  if (btnCloseAddModal)   btnCloseAddModal.addEventListener('click', closeModal);
  if (btnCancelAddModal)  btnCancelAddModal.addEventListener('click', closeModal);

  // Auto open modal if navigated with ?open_add=1
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('open_add') === '1' || urlParams.get('add') === 'true') {
    setTimeout(openModal, 250);
  }

  if (modalAddPatient) {
    modalAddPatient.addEventListener('click', (e) => {
      if (e.target === modalAddPatient) closeModal();
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
          closeModal();
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

  // Initial Load & Refresh Interval
  loadPatientRoster();
  setInterval(loadPatientRoster, 5000);
});
