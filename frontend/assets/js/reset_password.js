/**
 * Dedicated Password Reset Page Controller
 * ESP32 Home Patient Monitoring System
 */

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const userEmail = (urlParams.get('email') || '').trim();
  const resetToken = (urlParams.get('token') || urlParams.get('reset_token') || '').trim();

  const title = document.getElementById('title');
  const subtitle = document.getElementById('subtitle');
  const pointerLight = document.getElementById('pointerLight');
  const form = document.getElementById('resetPasswordForm');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  const toggleEyeNew = document.getElementById('toggleEyeNew');
  const toggleEyeConfirm = document.getElementById('toggleEyeConfirm');
  const resetErrorMsg = document.getElementById('resetErrorMsg');
  const submitBtn = document.getElementById('btnSubmitResetPassword');
  const reqChars = document.getElementById('reqChars');
  const reqNum = document.getElementById('reqNum');
  const reqCase = document.getElementById('reqCase');

  // If parameters are missing, bounce back to login
  if (!userEmail || !userEmail.includes('@') || !resetToken) {
    if (resetErrorMsg) {
      resetErrorMsg.textContent = 'Invalid or expired reset session. Redirecting to login…';
      resetErrorMsg.style.display = 'block';
    }
    setTimeout(() => {
      window.location.replace('auth.html');
    }, 2000);
    return;
  }

  // Update subtitle with email
  if (subtitle) {
    subtitle.innerHTML = `Enter and confirm a new secure password for<br><strong style="color:#e0e7ff;">${userEmail}</strong>.`;
  }

  // Pointer Light ambient glow
  document.addEventListener('pointermove', (e) => {
    if (pointerLight && e.pointerType === 'mouse') {
      pointerLight.style.left = `${e.clientX}px`;
      pointerLight.style.top = `${e.clientY}px`;
    }
  });

  // Eye toggles for passwords
  function setupEyeToggle(inputEl, toggleBtn) {
    if (!inputEl || !toggleBtn) return;
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPass = inputEl.type === 'password';
      inputEl.type = isPass ? 'text' : 'password';
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        icon.className = isPass ? 'ri-eye-off-line' : 'ri-eye-line';
      }
    });
  }
  setupEyeToggle(newPassword, toggleEyeNew);
  setupEyeToggle(confirmPassword, toggleEyeConfirm);

  // Live password requirements
  if (newPassword) {
    newPassword.addEventListener('input', () => {
      const val = newPassword.value;
      const hasLen = val.length >= 6;
      const hasNum = /[0-9]/.test(val);
      const hasCase = /[a-z]/.test(val) && /[A-Z]/.test(val);

      function updateReq(el, isValid) {
        if (!el) return;
        if (isValid) {
          el.classList.add('valid');
          el.style.color = '#34d399';
          const icon = el.querySelector('i');
          if (icon) {
            icon.className = 'ri-checkbox-circle-fill';
            icon.style.color = '#10b981';
          }
        } else {
          el.classList.remove('valid');
          el.style.color = '#a1a1aa';
          const icon = el.querySelector('i');
          if (icon) {
            icon.className = 'ri-circle-line';
            icon.style.color = '#a1a1aa';
          }
        }
      }

      updateReq(reqChars, hasLen);
      updateReq(reqNum, hasNum);
      updateReq(reqCase, hasCase);

      if (resetErrorMsg && resetErrorMsg.style.display === 'block') {
        resetErrorMsg.style.display = 'none';
      }
    });
  }

  // Form Submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pass = newPassword ? newPassword.value : '';
      const conf = confirmPassword ? confirmPassword.value : '';

      if (resetErrorMsg) {
        resetErrorMsg.style.display = 'none';
        resetErrorMsg.textContent = '';
      }

      if (pass.length < 6) {
        if (resetErrorMsg) {
          resetErrorMsg.textContent = 'Password must be at least 6 characters long.';
          resetErrorMsg.style.display = 'block';
        }
        if (newPassword) newPassword.focus();
        return;
      }

      if (pass !== conf) {
        if (resetErrorMsg) {
          resetErrorMsg.textContent = 'Passwords do not match. Please verify and re-type.';
          resetErrorMsg.style.display = 'block';
        }
        if (confirmPassword) confirmPassword.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Updating Password...</span> <i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i>';
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
          if (title) title.textContent = 'Password Updated!';
          if (subtitle) subtitle.innerHTML = 'Your password has been reset successfully.<br>Redirecting to <strong>Login</strong>…';

          if (submitBtn) {
            submitBtn.style.background = '#10b981';
            submitBtn.innerHTML = '<span>Success! Redirecting...</span> <i class="ri-checkbox-circle-line"></i>';
          }

          // Clear any stale local user state
          sessionStorage.removeItem('auth_user');

          // Smoothly redirect to auth.html login portal after 1.5 seconds
          setTimeout(() => {
            window.location.href = `auth.html?reset=success&email=${encodeURIComponent(userEmail)}`;
          }, 1500);

        } else {
          if (resetErrorMsg) {
            resetErrorMsg.textContent = data.message || 'Failed to update password. Please try again.';
            resetErrorMsg.style.display = 'block';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Update Password</span> <i class="ri-arrow-right-line"></i>';
          }
        }
      } catch (err) {
        if (resetErrorMsg) {
          resetErrorMsg.textContent = 'Connection error. Unable to reach server.';
          resetErrorMsg.style.display = 'block';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Update Password</span> <i class="ri-arrow-right-line"></i>';
        }
      }
    });
  }
});
