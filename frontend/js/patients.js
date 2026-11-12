/**
 * Central Doctor Dashboard — Main Orchestrator
 * Integrates PatientApi and PatientUI modules for patient management and IoT device pairing
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM References: Containers
  const patientCardsGrid   = document.getElementById('patientCardsGrid');
  const patientTableWrap   = document.getElementById('patientTableWrap');
  const patientTableBody   = document.getElementById('patientTableBody');

  // DOM References: Executive KPIs
  const statTotalMonitored = document.getElementById('statTotalMonitored');
  const statBedsFreed      = document.getElementById('statBedsFreed');
  const statRiskTiers      = document.getElementById('statRiskTiers');
  const statActiveNodes    = document.getElementById('statActiveNodes');
  const kpiTopDecongested  = document.getElementById('kpiTopDecongested');
  const kpiTopNodes        = document.getElementById('kpiTopNodes');
  const badgeActiveAlerts  = document.getElementById('badgeActiveAlerts');

  // DOM References: Filters & View Modes
  const searchInput        = document.getElementById('patientSearchInput');
  const wardFilter         = document.getElementById('wardOriginFilter');
  const filterChips        = document.querySelectorAll('.filter-chip');
  const btnViewCards       = document.getElementById('btnViewCards');
  const btnViewTable       = document.getElementById('btnViewTable');

  // DOM References: Add Modal
  const modalAddPatient    = document.getElementById('modalAddPatient');
  const btnOpenAddModal    = document.getElementById('btnOpenAddModal');
  const btnNavOpenAddModal = document.getElementById('btnNavOpenAddModal');
  const btnCloseAddModal   = document.getElementById('btnCloseAddModal');
  const btnCancelAddModal  = document.getElementById('btnCancelAddModal');
  const formAddPatient     = document.getElementById('formAddPatient');

  // DOM References: Delete Modal
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
  let currentViewMode = 'cards';
  let currentCsrfToken = '';
  let patientToDelete = null;

  // ---------------------------------------------------------------------------
  // 1. DATA REFRESH & KPI SYNC
  // ---------------------------------------------------------------------------
  async function loadPatientRoster() {
    try {
      const json = await window.PatientApi.getRoster();
      if (json.success && json.data) {
        allPatients = json.data.patients || [];
        updateKpiStats(json.data.stats || {});
        renderRoster();
      }
    } catch (err) {
      console.warn('Roster refresh warning:', err);
      if (!allPatients.length) {
        patientCardsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #f87171;">
            <i class="ri-error-warning-line" style="font-size: 32px;"></i>
            <p style="margin-top: 10px;">Failed to connect to patient directory. Please check server.</p>
          </div>
        `;
      }
    }
  }

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

  // ---------------------------------------------------------------------------
  // 2. ROSTER RENDERING (CARDS & TABLE)
  // ---------------------------------------------------------------------------
  function renderRoster() {
    const filtered = allPatients.filter(p => {
      if (currentRiskFilter !== 'all' && p.risk_status.toLowerCase() !== currentRiskFilter.toLowerCase()) return false;
      if (currentWardFilter && !p.ward_origin.toLowerCase().includes(currentWardFilter.toLowerCase())) return false;
      if (currentSearchQuery) {
        const devUid = p.assigned_device?.device_uid || '';
        const haystack = `${p.full_name} ${p.patient_code} ${devUid} ${p.ward_origin}`.toLowerCase();
        if (!haystack.includes(currentSearchQuery)) return false;
      }
      return true;
    });

    if (currentViewMode === 'cards') {
      patientCardsGrid.style.display = 'grid';
      patientTableWrap.classList.remove('active');
      if (!filtered.length) {
        patientCardsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-dim);">
            <i class="ri-user-unfollow-line" style="font-size: 32px;"></i>
            <p style="margin-top: 10px;">No patients match your search or filter criteria.</p>
          </div>
        `;
      } else {
        patientCardsGrid.innerHTML = filtered.map(p => window.PatientUI.renderCard(p)).join('');
      }
    } else {
      patientCardsGrid.style.display = 'none';
      patientTableWrap.classList.add('active');
      if (!filtered.length) {
        patientTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--text-dim);">No patients match your criteria.</td></tr>`;
      } else {
        patientTableBody.innerHTML = filtered.map(p => window.PatientUI.renderTableRow(p)).join('');
      }
    }

    bindDeleteButtons();
  }

  // ---------------------------------------------------------------------------
  // 3. DELETE PATIENT MODAL & ACTION
  // ---------------------------------------------------------------------------
  function bindDeleteButtons() {
    document.querySelectorAll('.btn-delete-patient').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        patientToDelete = {
          id: decodeURIComponent(btn.getAttribute('data-id')),
          name: btn.getAttribute('data-name'),
          code: btn.getAttribute('data-code'),
          device: btn.getAttribute('data-device')
        };
        if (deletePatientName) deletePatientName.textContent = patientToDelete.name;
        if (deletePatientCode) deletePatientCode.textContent = '#' + patientToDelete.code;
        if (deleteDeviceUid) deleteDeviceUid.textContent = patientToDelete.device;
        if (modalDeletePatient) modalDeletePatient.classList.add('active');
      };
    });
  }

  function closeDeleteModal() {
    patientToDelete = null;
    if (modalDeletePatient) modalDeletePatient.classList.remove('active');
  }

  if (btnCloseDeleteModal)  btnCloseDeleteModal.onclick = closeDeleteModal;
  if (btnCancelDeleteModal) btnCancelDeleteModal.onclick = closeDeleteModal;
  if (modalDeletePatient) {
    modalDeletePatient.onclick = (e) => { if (e.target === modalDeletePatient) closeDeleteModal(); };
  }

  if (btnConfirmDelete) {
    btnConfirmDelete.onclick = async () => {
      if (!patientToDelete) return;
      const targetId = patientToDelete.id;
      btnConfirmDelete.disabled = true;
      btnConfirmDelete.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i> Removing...';

      try {
        const json = await window.PatientApi.deletePatient(targetId, currentCsrfToken);
        if (json.success) {
          closeDeleteModal();
          allPatients = allPatients.filter(p => p.id !== targetId && p.patient_code !== targetId);
          renderRoster();
          await loadPatientRoster();
        } else {
          alert('Failed to remove patient: ' + (json.message || 'Server error'));
        }
      } catch {
        alert('Network communication error while removing patient.');
      } finally {
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.innerHTML = '<i class="ri-delete-bin-7-line"></i> <span>Confirm Delete</span>';
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 4. SEARCH, FILTERS & VIEW MODES
  // ---------------------------------------------------------------------------
  if (searchInput) {
    searchInput.oninput = (e) => {
      currentSearchQuery = e.target.value.toLowerCase().trim();
      renderRoster();
    };
  }

  if (wardFilter) {
    wardFilter.onchange = (e) => {
      currentWardFilter = e.target.value.trim();
      renderRoster();
    };
  }

  filterChips.forEach(chip => {
    chip.onclick = () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentRiskFilter = chip.getAttribute('data-filter') || 'all';
      renderRoster();
    };
  });

  if (btnViewCards && btnViewTable) {
    btnViewCards.onclick = () => {
      currentViewMode = 'cards';
      btnViewCards.classList.add('active');
      btnViewTable.classList.remove('active');
      renderRoster();
    };
    btnViewTable.onclick = () => {
      currentViewMode = 'table';
      btnViewTable.classList.add('active');
      btnViewCards.classList.remove('active');
      renderRoster();
    };
  }

  // ---------------------------------------------------------------------------
  // 5. ADD PATIENT MODAL
  // ---------------------------------------------------------------------------
  async function openAddModal() {
    if (!modalAddPatient) return;
    modalAddPatient.classList.add('active');
    currentCsrfToken = await window.PatientApi.getCsrfToken();

    const uidInput = document.getElementById('inputDeviceUid');
    if (uidInput && !uidInput.value) {
      uidInput.value = 'ESP32-NODE-0' + (allPatients.length + 1);
    }
    const macInput = document.getElementById('inputDeviceMac');
    if (macInput && !macInput.value) {
      macInput.value = '24:6F:28:' + Math.floor(10 + Math.random() * 89) + ':' + Math.floor(10 + Math.random() * 89) + ':' + Math.floor(10 + Math.random() * 89);
    }
  }

  function closeAddModal() {
    if (modalAddPatient) {
      modalAddPatient.classList.remove('active');
      if (formAddPatient) formAddPatient.reset();
    }
  }

  if (btnOpenAddModal)    btnOpenAddModal.onclick = openAddModal;
  if (btnNavOpenAddModal) btnNavOpenAddModal.onclick = openAddModal;
  if (btnCloseAddModal)   btnCloseAddModal.onclick = closeAddModal;
  if (btnCancelAddModal)  btnCancelAddModal.onclick = closeAddModal;
  if (modalAddPatient) {
    modalAddPatient.onclick = (e) => { if (e.target === modalAddPatient) closeAddModal(); };
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('open_add') === '1' || urlParams.get('add') === 'true') {
    setTimeout(openAddModal, 250);
  }

  if (formAddPatient) {
    formAddPatient.onsubmit = async (e) => {
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
        const data = await window.PatientApi.createPatient(payload, currentCsrfToken);
        if (data.success) {
          closeAddModal();
          await loadPatientRoster();
          const newId = data.data?.patient?.id;
          if (confirm(`Patient ${payload.full_name} successfully discharged and paired with ${payload.device_uid}!\n\nOpen Dedicated Telemetry HUD now?`)) {
            window.location.href = `index.html?patient_id=${encodeURIComponent(newId)}`;
          }
        } else {
          alert('Failed to onboard patient: ' + (data.message || 'Unknown error'));
        }
      } catch {
        alert('Network error while saving patient and device.');
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    };
  }

  // Initial load and periodic background polling (every 5 seconds)
  loadPatientRoster();
  setInterval(loadPatientRoster, 5000);
});
