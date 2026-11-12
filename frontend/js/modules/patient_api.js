/**
 * Patient API Service Module
 * Handles all network requests for patient directory & hardware pairing
 */

(function(root) {
  const PatientApi = {
    /**
     * Fetch active roster with calculated device online/offline status
     */
    async getRoster() {
      const res = await fetch('../api/patients/list.php');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    },

    /**
     * Onboard and pair a new patient with an ESP32 hardware device
     */
    async createPatient(payload, csrfToken) {
      const res = await fetch('../api/patients/create.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify(payload)
      });
      return await res.json();
    },

    /**
     * Discharge/delete patient and unassign associated IoT hardware node
     */
    async deletePatient(patientId, csrfToken) {
      const res = await fetch('../api/patients/delete.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({ patient_id: patientId })
      });
      return await res.json();
    },

    /**
     * Get fresh CSRF token for state-changing operations
     */
    async getCsrfToken() {
      try {
        const res = await fetch('../api/auth/csrf.php');
        const data = await res.json();
        return data?.data?.csrf_token || '';
      } catch {
        return '';
      }
    }
  };

  root.PatientApi = PatientApi;
})(typeof window !== 'undefined' ? window : this);
