/**
 * Clinical Telemetry — Set Credentials Controller
 * Handles new password confirmation, live 5-point strength evaluation,
 * and secure credential update for clinicians.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Retrieve session credentials (prefer sessionStorage, fallback to URL parameters)
  const urlParams = new URLSearchParams(window.location.search);
  const userEmail = (sessionStorage.getItem('reset_email') || urlParams.get('email') || '').trim();
  const resetToken = (sessionStorage.getItem('reset_token') || urlParams.get('token') || urlParams.get('reset_token') || '').trim();

  const form = document.getElementById('setCredentialsForm');
  const cardSubtitle = document.getElementById('cardSubtitle');
  const pointerLight = document.getElementById('pointerLight');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  const toggleEyeNew = document.getElementById('toggleEyeNew');
  const pStatus = document.getElementById('pStatus');
  const rangeStatus = document.getElementById('rangeStatus');
  const strengthIcon = document.getElementById('strengthIcon');
  const matchIndicator = document.getElementById('matchIndicator');
  const resetErrorMsg = document.getElementById('resetErrorMsg');
  const btnSubmitReset = document.getElementById('btnSubmitReset');

  // Verify access authorization
  if (!userEmail || !userEmail.includes('@') || !resetToken) {
    if (resetErrorMsg) {
      resetErrorMsg.textContent = 'No active verification session detected. Redirecting to Login…';
      resetErrorMsg.style.display = 'block';
    }
    setTimeout(() => {
      window.location.replace('auth.html');
    }, 2200);
    return;
  }

  // Display user email in card subtitle
  if (cardSubtitle) {
    cardSubtitle.innerHTML = `Enter and reconfirm your new clinical access credentials for <strong style="color:#e0e7ff;">${userEmail}</strong>.`;
  }

  // ---------------------------------------------------------------------------
  // 2. Ambient Pointer Light
  // ---------------------------------------------------------------------------
  document.addEventListener('pointermove', (e) => {
    if (pointerLight && e.pointerType === 'mouse') {
      pointerLight.style.left = `${e.clientX}px`;
      pointerLight.style.top = `${e.clientY}px`;
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Show/Hide Password Toggle (Box 1 Only)
  // ---------------------------------------------------------------------------
  if (newPassword && toggleEyeNew) {
    toggleEyeNew.addEventListener('click', (e) => {
      e.preventDefault();
      const isPass = newPassword.type === 'password';
      newPassword.type = isPass ? 'text' : 'password';
      const icon = toggleEyeNew.querySelector('i');
      if (icon) {
        icon.className = isPass ? 'ri-eye-off-line' : 'ri-eye-line';
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Live 5-Point Password Strength Evaluator (Matches Registration)
  // ---------------------------------------------------------------------------
  function updateReqItem(id, isValid) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isValid) {
      el.classList.add('valid');
    } else {
      el.classList.remove('valid');
    }
  }

  function updateStrength(score, hasText) {
    if (!pStatus || !rangeStatus || !strengthIcon) return;

    if (!hasText) {
      pStatus.innerText = 'Weak';
      pStatus.style.color = '#ef4444';
      rangeStatus.style.width = '0%';
      rangeStatus.style.background = '#ef4444';
      strengthIcon.className = 'ri-shield-line';
      strengthIcon.style.color = '#ef4444';
      if (strengthIcon.parentElement) {
        strengthIcon.parentElement.style.background = 'rgba(239, 68, 68, 0.1)';
      }
      return;
    }

    if (score <= 2) {
      pStatus.innerText = 'Weak';
      pStatus.style.color = '#ef4444';
      rangeStatus.style.width = '25%';
      rangeStatus.style.background = '#ef4444';
      strengthIcon.className = 'ri-shield-line';
      strengthIcon.style.color = '#ef4444';
      if (strengthIcon.parentElement) {
        strengthIcon.parentElement.style.background = 'rgba(239, 68, 68, 0.12)';
      }
    } else if (score <= 4) {
      pStatus.innerText = 'Medium';
      pStatus.style.color = '#f59e0b';
      rangeStatus.style.width = '65%';
      rangeStatus.style.background = '#f59e0b';
      strengthIcon.className = 'ri-shield-check-line';
      strengthIcon.style.color = '#f59e0b';
      if (strengthIcon.parentElement) {
        strengthIcon.parentElement.style.background = 'rgba(245, 158, 11, 0.12)';
      }
    } else {
      pStatus.innerText = 'Strong';
      pStatus.style.color = '#22c55e';
      rangeStatus.style.width = '100%';
      rangeStatus.style.background = '#22c55e';
      strengthIcon.className = 'ri-shield-check-fill';
      strengthIcon.style.color = '#22c55e';
      if (strengthIcon.parentElement) {
        strengthIcon.parentElement.style.background = 'rgba(34, 197, 94, 0.15)';
      }
    }
  }

  function checkMatch() {
    if (!matchIndicator || !confirmPassword || !newPassword) return;
    const pass = newPassword.value;
    const conf = confirmPassword.value;

    if (!conf) {
      matchIndicator.style.display = 'none';
      return;
    }

    matchIndicator.style.display = 'flex';
    matchIndicator.style.alignItems = 'center';
    matchIndicator.style.gap = '6px';

    if (pass === conf) {
      matchIndicator.innerHTML = '<i class="ri-checkbox-circle-fill" style="color:#22c55e;"></i> <span style="color:#86efac; font-weight:500;">Passwords match</span>';
    } else {
      matchIndicator.innerHTML = '<i class="ri-close-circle-fill" style="color:#ef4444;"></i> <span style="color:#fca5a5; font-weight:500;">Passwords do not match</span>';
    }
  }

  if (newPassword) {
    newPassword.addEventListener('input', () => {
      const val = newPassword.value;
      const hasLen = val.length >= 8;
      const hasUpper = /[A-Z]/.test(val);
      const hasLower = /[a-z]/.test(val);
      const hasNum = /[0-9]/.test(val);
      const hasSpecial = /[^A-Za-z0-9]/.test(val);

      updateReqItem('chars', hasLen);
      updateReqItem('AtoZ', hasUpper);
      updateReqItem('atoz', hasLower);
      updateReqItem('num', hasNum);
      updateReqItem('speChar', hasSpecial);

      const score = [hasLen, hasUpper, hasLower, hasNum, hasSpecial].filter(Boolean).length;
      updateStrength(score, val.length > 0);

      if (confirmPassword && confirmPassword.value) {
        checkMatch();
      }

      if (resetErrorMsg && resetErrorMsg.style.display === 'block') {
        resetErrorMsg.style.display = 'none';
      }
    });
  }

  if (confirmPassword) {
    confirmPassword.addEventListener('input', () => {
      checkMatch();
      if (resetErrorMsg && resetErrorMsg.style.display === 'block') {
        resetErrorMsg.style.display = 'none';
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Submit Form & Update Password via Session API
  // ---------------------------------------------------------------------------
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pass = (newPassword ? newPassword.value : '').trim();
      const conf = (confirmPassword ? confirmPassword.value : '').trim();

      if (resetErrorMsg) {
        resetErrorMsg.style.display = 'none';
        resetErrorMsg.textContent = '';
      }

      // Validation 1: Length check
      if (pass.length < 8) {
        if (resetErrorMsg) {
          resetErrorMsg.textContent = 'Password must be at least 8 characters long.';
          resetErrorMsg.style.display = 'block';
        }
        if (newPassword) newPassword.focus();
        return;
      }

      // Validation 2: Match check
      if (pass !== conf) {
        if (resetErrorMsg) {
          resetErrorMsg.textContent = 'Passwords do not match. Please verify and retype in the confirmation box.';
          resetErrorMsg.style.display = 'block';
        }
        if (confirmPassword) confirmPassword.focus();
        return;
      }

      // Lock submit button
      if (btnSubmitReset) {
        btnSubmitReset.disabled = true;
        btnSubmitReset.innerHTML = '<span>Updating Credentials...</span> <i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i>';
      }

      try {
        const res = await fetch('../api/auth/session.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset_password',
            email: userEmail,
            reset_token: resetToken,
            password: pass
          })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          // Clear reset items from sessionStorage
          sessionStorage.removeItem('reset_email');
          sessionStorage.removeItem('reset_token');
          sessionStorage.removeItem('auth_user');

          const cardTitle = document.querySelector('.card-title');
          if (cardTitle) cardTitle.textContent = 'Password Updated!';
          if (cardSubtitle) cardSubtitle.innerHTML = 'Your password has been successfully updated.<br>Redirecting to <strong style="color:#818cf8;">Login</strong>…';

          if (btnSubmitReset) {
            btnSubmitReset.style.background = '#10b981';
            btnSubmitReset.innerHTML = '<span>Success! Redirecting...</span> <i class="ri-checkbox-circle-line"></i>';
          }

          // Redirect to login interface with success notice and prefilled email
          setTimeout(() => {
            window.location.href = `auth.html?reset=success&email=${encodeURIComponent(userEmail)}`;
          }, 1500);

        } else {
          if (resetErrorMsg) {
            resetErrorMsg.textContent = data.message || 'Failed to update credentials. Please try again.';
            resetErrorMsg.style.display = 'block';
          }
          if (btnSubmitReset) {
            btnSubmitReset.disabled = false;
            btnSubmitReset.innerHTML = '<span>Confirm Password</span> <i class="ri-arrow-right-line"></i>';
          }
        }
      } catch (err) {
        if (resetErrorMsg) {
          resetErrorMsg.textContent = 'Connection error. Unable to communicate with authentication server.';
          resetErrorMsg.style.display = 'block';
        }
        if (btnSubmitReset) {
          btnSubmitReset.disabled = false;
          btnSubmitReset.innerHTML = '<span>Confirm Password</span> <i class="ri-arrow-right-line"></i>';
        }
      }
    });
  }
});
