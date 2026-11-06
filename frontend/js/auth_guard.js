/**
 * Client-Side Authentication Guard & Session Manager
 * ESP32 Home Patient Monitoring System
 *
 * Protects clinical telemetry and patient directories against unauthorized access.
 */
(function() {
  // 1. Immediate Gatekeeper: Redirect unauthenticated visitors to Login
  const authUserJson = sessionStorage.getItem('auth_user');
  
  if (!authUserJson) {
    window.location.replace('auth.html');
    return;
  }

  try {
    const user = JSON.parse(authUserJson);
    if (!user || (!user.authenticated && !user.username && !user.email)) {
      sessionStorage.removeItem('auth_user');
      window.location.replace('auth.html');
      return;
    }
  } catch (err) {
    sessionStorage.removeItem('auth_user');
    window.location.replace('auth.html');
    return;
  }

  // 2. DOM Ready Setup: Populate Clinician Profile badge & Wire Logout
  document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    try {
      currentUser = JSON.parse(sessionStorage.getItem('auth_user'));
    } catch (e) {}

    // Populate user name in top navigation badge if element exists
    const navUserBadge = document.getElementById('navUserBadge');
    if (navUserBadge && currentUser) {
      navUserBadge.innerText = currentUser.full_name || currentUser.username || 'Dr. S. Jenkins, MD';
    }

    // Wire Logout Button
    const btnLogout = document.getElementById('btnNavLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        btnLogout.disabled = true;
        btnLogout.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i> Logging out...';

        try {
          await fetch('../api/auth/session.php?action=logout', { method: 'POST' });
        } catch (err) {
          console.warn('Logout API sync fallback');
        }

        sessionStorage.removeItem('auth_user');
        window.location.replace('auth.html');
      });
    }
  });

  // Global helper for programmatic logout
  window.clinicalLogout = async function() {
    try {
      await fetch('../api/auth/session.php?action=logout', { method: 'POST' });
    } catch (e) {}
    sessionStorage.removeItem('auth_user');
    window.location.replace('auth.html');
  };
})();
