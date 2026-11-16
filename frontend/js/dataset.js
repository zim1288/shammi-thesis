/**
 * Dataset Management & Collection Reset Controller
 * ESP32 Home Patient Monitoring System
 */

(function() {
  'use strict';

  let csrfToken = '';
  let pendingResetAction = null; // { action: 'reset_collection' | 'reset_all', collection?: string, count?: number }
  let currentCollectionsData = [];

  // DOM Elements
  const lblStorageMode = document.getElementById('lblStorageMode');
  const lblTotalDocs = document.getElementById('lblTotalDocs');
  const kpiDbName = document.getElementById('kpiDbName');
  const collectionsGrid = document.getElementById('collectionsGrid');
  const btnRefreshStats = document.getElementById('btnRefreshStats');
  const btnMasterReset = document.getElementById('btnMasterReset');
  const chkPreservePatients = document.getElementById('chkPreservePatients');
  const confirmModal = document.getElementById('confirmModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const txtConfirmKeyword = document.getElementById('txtConfirmKeyword');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnExecuteReset = document.getElementById('btnExecuteReset');
  const btnExecuteResetText = document.getElementById('btnExecuteResetText');
  const auditTableBody = document.getElementById('auditTableBody');

  /**
   * Fetch Cryptographic CSRF Token
   */
  async function fetchCsrfToken() {
    try {
      const res = await fetch(APP_CONFIG.api.csrf, { cache: 'no-store', credentials: 'same-origin' });
      const data = await res.json();
      if (data && data.data) {
        csrfToken = data.data.csrf_token || data.data.token || '';
      }
    } catch (err) {
      console.warn('CSRF fetch warning:', err);
    }
    return csrfToken;
  }

  /**
   * Load Live Collection Statistics
   */
  async function loadDatabaseStats() {
    btnRefreshStats.disabled = true;
    btnRefreshStats.innerHTML = '<i class="ri-loader-4-line" style="display:inline-block;animation:spin 1s linear infinite;"></i> <span>Updating...</span>';

    try {
      const res = await fetch(APP_CONFIG.api.databaseStats);
      const json = await res.json();

      if (!json || !json.success || !json.data) {
        throw new Error(json.message || 'Failed to retrieve database statistics');
      }

      const data = json.data;
      currentCollectionsData = data.collections || [];

      // Update Global KPIs
      if (lblStorageMode) {
        const mode = data.storage_mode === 'mongodb_atlas' ? 'MongoDB Atlas (Live)' : (data.storage_mode || 'Local JSON');
        lblStorageMode.innerText = mode;
        if (data.is_connected) {
          lblStorageMode.style.color = '#34d399';
        }
      }

      if (lblTotalDocs) {
        lblTotalDocs.innerText = Number(data.total_documents || 0).toLocaleString();
      }

      if (kpiDbName && data.database_name) {
        kpiDbName.innerText = data.database_name;
      }

      renderCollections(currentCollectionsData);
    } catch (err) {
      console.error('Error loading database statistics:', err);
      collectionsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: #ef4444; background: rgba(239, 68, 68, 0.1); border-radius: 14px; border: 1px solid rgba(239, 68, 68, 0.3);">
          <i class="ri-error-warning-line" style="font-size: 32px;"></i>
          <p style="margin-top: 8px; font-weight: 600;">Failed to connect to database stats API</p>
          <p style="font-size: 12px; color: #cbd5e1; margin-top: 4px;">${err.message}</p>
        </div>
      `;
    } finally {
      btnRefreshStats.disabled = false;
      btnRefreshStats.innerHTML = '<i class="ri-refresh-line"></i> <span>Refresh Counts</span>';
    }
  }

  /**
   * Render Collections Grid
   */
  function renderCollections(collections) {
    if (!collections || collections.length === 0) {
      collectionsGrid.innerHTML = '<p style="color: var(--text-muted); text-align: center; grid-column: 1 / -1;">No collections detected in database.</p>';
      return;
    }

    collectionsGrid.innerHTML = collections.map(col => {
      const isCritical = col.name === 'patients' || col.name === 'devices';
      const count = Number(col.count || 0);
      const isZero = count === 0;

      return `
        <div class="col-card ${isCritical ? 'warning-card' : ''}">
          <div>
            <div class="col-header">
              <div class="col-icon" style="${isCritical ? 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3);' : ''}">
                <i class="${col.icon || 'ri-folder-line'}"></i>
              </div>
              <div style="flex-grow: 1;">
                <div class="col-title">${escapeHtml(col.label || col.name)}</div>
                <span class="col-tag">${escapeHtml(col.name)}</span>
              </div>
            </div>

            <p class="col-desc">${escapeHtml(col.description || 'Active database collection storage')}</p>
          </div>

          <div>
            <div class="col-stats-row">
              <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Stored Documents:</span>
              <span class="col-count-num" style="${isZero ? 'color: #94a3b8;' : 'color: #38bdf8;'}">
                ${count.toLocaleString()}
              </span>
            </div>

            <button type="button" 
                    class="btn-clear-col" 
                    data-collection="${escapeHtml(col.name)}" 
                    data-label="${escapeHtml(col.label || col.name)}"
                    data-count="${count}"
                    ${isZero ? 'disabled' : ''}>
              <i class="ri-delete-bin-line"></i>
              <span>${isZero ? 'Collection Empty (0 docs)' : `Clear ${escapeHtml(col.name)} (${count.toLocaleString()})`}</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Wire Clear Buttons
    collectionsGrid.querySelectorAll('.btn-clear-col').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const colName = btn.dataset.collection;
        const colLabel = btn.dataset.label;
        const count = parseInt(btn.dataset.count, 10) || 0;
        openSingleCollectionModal(colName, colLabel, count);
      });
    });
  }

  /**
   * Open Modal for Single Collection Purge
   */
  function openSingleCollectionModal(colName, colLabel, count) {
    pendingResetAction = {
      action: 'reset_collection',
      collection: colName,
      count: count,
      label: colLabel
    };

    modalTitle.innerHTML = `<span style="color: #ef4444;">Purge Collection:</span> ${escapeHtml(colName)}`;
    modalBody.innerHTML = `
      You are about to empty <strong>${count.toLocaleString()} documents</strong> from the 
      <strong style="color: #38bdf8;">"${escapeHtml(colName)}"</strong> collection.<br><br>
      <div style="background: rgba(255,255,255,0.04); padding: 10px 14px; border-radius: 8px; border-left: 3px solid #10b981; font-size: 12px; color: #cbd5e1;">
        <i class="ri-shield-check-line" style="color: #10b981;"></i> <strong>Safe Reset:</strong> 
        The collection folder and schema will remain intact. Only the data records inside will be deleted.
      </div>
    `;

    txtConfirmKeyword.value = '';
    btnExecuteReset.disabled = true;
    btnExecuteResetText.innerText = `Empty "${colName}"`;
    confirmModal.classList.add('active');
    txtConfirmKeyword.focus();
  }

  /**
   * Open Modal for Master Whole Dataset Reset
   */
  function openMasterResetModal() {
    const preserve = chkPreservePatients.checked;
    pendingResetAction = {
      action: 'reset_all',
      preserve_patients: preserve
    };

    const targetDesc = preserve 
      ? 'All telemetry streams (alerts, sensor readings, ECG batches, live readings, manual BP) will be emptied. <strong>Registered patients and devices will be preserved.</strong>'
      : '<strong>EVERY COLLECTION</strong> in the database (including patient directory and paired IoT devices) will be emptied.';

    modalTitle.innerHTML = `<span style="color: #ef4444;">⚠️ Master Dataset Reset</span>`;
    modalBody.innerHTML = `
      You are about to wipe records across all collections in <strong style="color: #38bdf8;">patient_monitor</strong>.<br><br>
      <div style="background: rgba(239,68,68,0.1); padding: 12px 14px; border-radius: 8px; border-left: 3px solid #ef4444; font-size: 12px; color: #fca5a5; line-height: 1.5;">
        ${targetDesc}
      </div>
      <br>
      The collection folders and structure will remain completely intact. Incoming ESP32 telemetry will start from zero records.
    `;

    txtConfirmKeyword.value = '';
    btnExecuteReset.disabled = true;
    btnExecuteResetText.innerText = 'Confirm Master Reset';
    confirmModal.classList.add('active');
    txtConfirmKeyword.focus();
  }

  /**
   * Close Modal
   */
  function closeModal() {
    confirmModal.classList.remove('active');
    pendingResetAction = null;
    txtConfirmKeyword.value = '';
    btnExecuteReset.disabled = true;
  }

  /**
   * Execute Verified Reset API Request
   */
  async function executeReset() {
    if (!pendingResetAction) return;

    btnExecuteReset.disabled = true;
    btnCancelModal.disabled = true;
    btnExecuteReset.innerHTML = '<i class="ri-loader-4-line" style="display:inline-block;animation:spin 1s linear infinite;"></i> <span>Purging...</span>';

    try {
      // Refresh CSRF token immediately prior to state-changing request
      const activeCsrf = await fetchCsrfToken();

      const payload = {
        action: pendingResetAction.action,
        collection: pendingResetAction.collection || '',
        preserve_patients: pendingResetAction.preserve_patients || false,
        confirm_text: txtConfirmKeyword.value.trim().toUpperCase(),
        csrf_token: activeCsrf
      };

      const res = await fetch(APP_CONFIG.api.databaseReset, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': activeCsrf
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (!json || !json.success) {
        throw new Error(json.message || 'Reset failed on server');
      }

      // Add to Session Audit Table
      addAuditRow(
        pendingResetAction.action === 'reset_all' ? 'Master Dataset Reset' : 'Selective Purge',
        pendingResetAction.collection || (pendingResetAction.preserve_patients ? 'Telemetry (Preserved Patients)' : 'All Collections'),
        json.data.total_deleted !== undefined ? json.data.total_deleted : (json.data.deleted_count || 0),
        'Success'
      );

      closeModal();
      await loadDatabaseStats();
      showToast('Dataset reset completed successfully!', 'success');
    } catch (err) {
      console.error('Reset execution error:', err);
      alert('Error executing reset: ' + err.message);
      btnExecuteReset.disabled = false;
      btnCancelModal.disabled = false;
      btnExecuteReset.innerHTML = '<i class="ri-delete-bin-line"></i> <span>Retry Reset</span>';
    } finally {
      btnCancelModal.disabled = false;
    }
  }

  /**
   * Append Record to Session Audit Log
   */
  function addAuditRow(operation, target, deletedCount, status) {
    // Remove "no operations" placeholder row if present
    if (auditTableBody.children.length === 1 && auditTableBody.children[0].children.length === 1) {
      auditTableBody.innerHTML = '';
    }

    const now = new Date().toLocaleTimeString();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace; color: #94a3b8;">${now}</td>
      <td style="font-weight: 600; color: #f8fafc;">${escapeHtml(operation)}</td>
      <td><span style="font-family: monospace; color: #38bdf8; background: rgba(56,189,248,0.1); padding: 2px 6px; border-radius: 4px;">${escapeHtml(target)}</span></td>
      <td style="font-family: monospace; font-weight: 700; color: #fca5a5;">${Number(deletedCount).toLocaleString()} docs</td>
      <td><span style="color: #34d399; font-weight: 600;"><i class="ri-check-line"></i> ${escapeHtml(status)}</span></td>
    `;
    auditTableBody.prepend(tr);
  }

  /**
   * Lightweight Toast Feedback
   */
  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.background = type === 'success' ? '#065f46' : '#1e293b';
    toast.style.color = '#ffffff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    toast.style.border = type === 'success' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.2)';
    toast.style.zIndex = '10000';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.fontWeight = '600';
    toast.style.fontSize = '13px';
    toast.innerHTML = `<i class="${type === 'success' ? 'ri-checkbox-circle-line' : 'ri-information-line'}" style="font-size: 18px;"></i> ${escapeHtml(msg)}`;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.5s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 500);
    }, 3500);
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

  // Event Listeners
  btnRefreshStats.addEventListener('click', loadDatabaseStats);
  btnMasterReset.addEventListener('click', openMasterResetModal);
  btnCancelModal.addEventListener('click', closeModal);
  btnExecuteReset.addEventListener('click', executeReset);

  // Keyboard verification check
  txtConfirmKeyword.addEventListener('input', (e) => {
    const val = e.target.value.trim().toUpperCase();
    btnExecuteReset.disabled = (val !== 'RESET');
  });

  // Close modal on Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmModal.classList.contains('active')) {
      closeModal();
    }
  });

  // Initialize
  document.addEventListener('DOMContentLoaded', async () => {
    await fetchCsrfToken();
    await loadDatabaseStats();
  });

})();
