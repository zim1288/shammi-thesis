/**
 * Scoped Manual Blood Pressure Modal Controller
 * ESP32 Home Patient Monitoring System
 *
 * Handles clinical manual vital submissions, CSRF tokens, input validation,
 * and broadcasts 'manualBpSaved' custom events upon successful entry.
 */

(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const modalManualBp         = document.getElementById('modalManualBp');
    const btnOpenManualBpModal  = document.getElementById('btnOpenManualBpModal');
    const btnTileOpenBpModal    = document.getElementById('btnTileOpenBpModal');
    const btnCloseManualBpModal = document.getElementById('btnCloseManualBpModal');
    const btnCancelManualBpModal= document.getElementById('btnCancelManualBpModal');
    const formManualBpModal     = document.getElementById('formManualBpModal');
    const modalBpFeedback       = document.getElementById('modalBpFeedback');

    const modalBpPatientName    = document.getElementById('modalBpPatientName');
    const modalBpPatientCode    = document.getElementById('modalBpPatientCode');
    const modalBpPatientSubtitle= document.getElementById('modalBpPatientSubtitle');
    const bpModalPatientId      = document.getElementById('bpModalPatientId');
    const bpModalCsrfToken      = document.getElementById('bpModalCsrfToken');

    if (!modalManualBp || !formManualBpModal) return;

    // Get current patient from URL query or app configuration
    function getActivePatientId() {
      const params = new URLSearchParams(window.location.search);
      return params.get('patient_id') || (window.APP_CONFIG ? window.APP_CONFIG.defaultPatientId : 'PT-8802');
    }

    // Open Modal and hydrate patient info + CSRF token
    async function openModal() {
      modalManualBp.classList.add('active');
      const patientId = getActivePatientId();

      // Read active patient metadata if exposed on window or from DOM
      const activePatient = window.currentPatientData || {};
      const pName = activePatient.full_name || document.getElementById('profilePatientName')?.innerText || 'Active Patient';
      const pCode = activePatient.patient_code || document.getElementById('profilePatientCode')?.innerText?.replace('#', '') || patientId;
      const pWard = activePatient.ward_origin || 'ICU Step-Down';

      if (modalBpPatientName) modalBpPatientName.innerText = pName;
      if (modalBpPatientCode) modalBpPatientCode.innerText = '#' + pCode;
      if (modalBpPatientSubtitle) modalBpPatientSubtitle.innerText = `Recording for: ${pName} (#${pCode}) • ${pWard}`;
      if (bpModalPatientId) bpModalPatientId.value = patientId;

      if (modalBpFeedback) {
        modalBpFeedback.style.display = 'none';
        modalBpFeedback.innerHTML = '';
      }

      // Default values
      const sysInput = document.getElementById('inputModalSys');
      const diaInput = document.getElementById('inputModalDia');
      if (sysInput && !sysInput.value) sysInput.value = '120';
      if (diaInput && !diaInput.value) diaInput.value = '80';

      // Autofill measurement timestamp to current local time
      const timeInput = document.getElementById('inputModalMeasurementTime');
      if (timeInput) {
        const now = new Date();
        const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        timeInput.value = localIso;
      }

      // Fetch fresh CSRF token
      try {
        const csrfEndpoint = (window.APP_CONFIG && window.APP_CONFIG.api && window.APP_CONFIG.api.csrf) ? window.APP_CONFIG.api.csrf : '../api/auth/csrf.php';
        const csrfRes = await fetch(csrfEndpoint);
        if (csrfRes.ok) {
          const json = await csrfRes.json();
          if (json.success && json.data.csrf_token && bpModalCsrfToken) {
            bpModalCsrfToken.value = json.data.csrf_token;
          }
        }
      } catch (e) {
        // CSRF fallback
      }
    }

    function closeModal() {
      modalManualBp.classList.remove('active');
    }

    // Bind modal trigger buttons
    if (btnOpenManualBpModal) btnOpenManualBpModal.addEventListener('click', openModal);
    if (btnTileOpenBpModal)   btnTileOpenBpModal.addEventListener('click', openModal);
    if (btnCloseManualBpModal)btnCloseManualBpModal.addEventListener('click', closeModal);
    if (btnCancelManualBpModal)btnCancelManualBpModal.addEventListener('click', closeModal);

    modalManualBp.addEventListener('click', (e) => {
      if (e.target === modalManualBp) closeModal();
    });

    // Form Submission Handler
    formManualBpModal.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btnSubmitManualBp');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i> Saving...';
      submitBtn.disabled = true;

      const patientId = getActivePatientId();
      const sysVal = parseInt(document.getElementById('inputModalSys').value, 10);
      const diaVal = parseInt(document.getElementById('inputModalDia').value, 10);
      const pulseVal = document.getElementById('inputModalPulse').value;
      const posture = document.getElementById('inputModalPosture').value;
      const staffVal = document.getElementById('inputModalStaff').value.trim() || 'Dr. S. Jenkins';
      const timeVal = document.getElementById('inputModalMeasurementTime')?.value || new Date().toISOString();
      const notesVal = document.getElementById('inputModalNotes').value.trim();

      const combinedNotes = notesVal ? `${notesVal} [Position: ${posture}]` : `Position: ${posture}`;

      const payload = {
        patient_id: patientId,
        systolic_bp: sysVal,
        diastolic_bp: diaVal,
        pulse_rate: pulseVal ? parseInt(pulseVal, 10) : null,
        measurement_timestamp: timeVal,
        recorded_by_name: staffVal,
        notes: combinedNotes,
        csrf_token: bpModalCsrfToken ? bpModalCsrfToken.value : ''
      };

      try {
        const bpEndpoint = (window.APP_CONFIG && window.APP_CONFIG.api && window.APP_CONFIG.api.manualBpEntry) 
          ? window.APP_CONFIG.api.manualBpEntry 
          : '../api/blood_pressure/manual_entry.php';

        const res = await fetch(bpEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': payload.csrf_token
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success || data.ok) {
          closeModal();

          // Dispatch event so live HUD and tables update seamlessly
          window.dispatchEvent(new CustomEvent('manualBpSaved', {
            detail: {
              patient_id: patientId,
              systolic_bp: sysVal,
              diastolic_bp: diaVal,
              pulse_rate: payload.pulse_rate,
              measurement_timestamp: timeVal,
              recorded_by: staffVal,
              notes: combinedNotes
            }
          }));

          if (window.showLiveToast) {
            window.showLiveToast(`✓ Blood Pressure recorded: ${sysVal}/${diaVal} mmHg`);
          }
        } else {
          if (modalBpFeedback) {
            modalBpFeedback.style.display = 'block';
            modalBpFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
            modalBpFeedback.style.border = '1px solid rgba(239, 68, 68, 0.35)';
            modalBpFeedback.style.color = '#f87171';
            modalBpFeedback.innerText = data.message || 'Validation error while saving blood pressure.';
          }
        }
      } catch (err) {
        if (modalBpFeedback) {
          modalBpFeedback.style.display = 'block';
          modalBpFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
          modalBpFeedback.style.border = '1px solid rgba(239, 68, 68, 0.35)';
          modalBpFeedback.style.color = '#f87171';
          modalBpFeedback.innerText = 'Network error. Please try again.';
        }
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  });
})();
