/**
 * Authentication & Security Controller (Login & Registration)
 * - 33-Login & SignUp Form (Sliding Panels)
 * - 113-Strong Password (Live Requirements & Dynamic Bar)
 * - Seamless Redirection: Login -> Dashboard | Register/Forgot -> OTP Page
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. DOM Element Selectors
  const authWrapper = document.getElementById('authWrapper');
  const registerToggleBtn = document.getElementById('registerToggleBtn');
  const loginToggleBtn = document.getElementById('loginToggleBtn');
  const pointerLight = document.getElementById('pointerLight');

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');

  // Password Elements
  const regPassword = document.getElementById('regPassword');
  const toggleEyeReg = document.getElementById('toggleEyeReg');
  const loginPassword = document.getElementById('loginPassword');
  const toggleEyeLogin = document.getElementById('toggleEyeLogin');

  const pStatus = document.getElementById('pStatus');
  const rangeStatus = document.getElementById('rangeStatus');
  const strengthIcon = document.getElementById('strengthIcon');
  const passwordStrengthContainer = document.getElementById('passwordStrengthContainer');

  // =========================================================================
  // 2. MOUSE POINTER AMBIENT LIGHT
  // =========================================================================
  document.addEventListener('pointermove', (e) => {
    if (pointerLight && e.pointerType === 'mouse') {
      pointerLight.style.left = `${e.clientX}px`;
      pointerLight.style.top = `${e.clientY}px`;
    }
  });

  // =========================================================================
  // 3. SLIDING AUTH CONTAINER TOGGLE (33-Login & SignUp Form)
  // =========================================================================
  if (registerToggleBtn && loginToggleBtn) {
    registerToggleBtn.addEventListener('click', () => {
      authWrapper.classList.add('active');
    });

    loginToggleBtn.addEventListener('click', () => {
      authWrapper.classList.remove('active');
    });
  }

  // Show/Hide Password Toggles
  function setupPasswordToggle(inputEl, toggleBtn) {
    if (!inputEl || !toggleBtn) return;
    toggleBtn.addEventListener('click', () => {
      const isPass = inputEl.type === 'password';
      inputEl.type = isPass ? 'text' : 'password';
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        icon.className = isPass ? 'ri-eye-off-line' : 'ri-eye-line';
      }
    });
  }

  setupPasswordToggle(regPassword, toggleEyeReg);
  setupPasswordToggle(loginPassword, toggleEyeLogin);

  // =========================================================================
  // 4. STRONG PASSWORD LIVE VALIDATOR (113-Strong Password)
  // =========================================================================
  if (regPassword) {
    regPassword.addEventListener('input', () => {
      const val = regPassword.value;

      // Only show the strength container when the user types a password
      if (val.length > 0) {
        if (passwordStrengthContainer) passwordStrengthContainer.classList.add('active');
      } else {
        if (passwordStrengthContainer) passwordStrengthContainer.classList.remove('active');
      }

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
      updateStrengthIndicator(score, val.length > 0);
    });

    regPassword.addEventListener('blur', () => {
      if (regPassword.value.length === 0 && passwordStrengthContainer) {
        passwordStrengthContainer.classList.remove('active');
      }
    });
  }

  function updateReqItem(id, isValid) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isValid) {
      el.classList.add('valid');
    } else {
      el.classList.remove('valid');
    }
  }

  function updateStrengthIndicator(score, hasText) {
    if (!pStatus || !rangeStatus || !strengthIcon) return;

    if (!hasText) {
      pStatus.innerText = 'None';
      rangeStatus.style.width = '0%';
      return;
    }

    if (score <= 1) {
      pStatus.innerText = 'Weak';
      pStatus.style.color = '#ef4444';
      rangeStatus.style.width = '20%';
      rangeStatus.style.background = '#ef4444';
      strengthIcon.className = 'ri-shield-line';
      strengthIcon.style.color = '#ef4444';
      strengthIcon.parentElement.style.background = 'rgba(239, 68, 68, 0.12)';
    } else if (score <= 3) {
      pStatus.innerText = 'Medium';
      pStatus.style.color = '#f59e0b';
      rangeStatus.style.width = '65%';
      rangeStatus.style.background = '#f59e0b';
      strengthIcon.className = 'ri-shield-check-line';
      strengthIcon.style.color = '#f59e0b';
      strengthIcon.parentElement.style.background = 'rgba(245, 158, 11, 0.12)';
    } else {
      pStatus.innerText = 'Strong';
      pStatus.style.color = '#22c55e';
      rangeStatus.style.width = '100%';
      rangeStatus.style.background = '#22c55e';
      strengthIcon.className = 'ri-shield-check-fill';
      strengthIcon.style.color = '#22c55e';
      strengthIcon.parentElement.style.background = 'rgba(34, 197, 94, 0.15)';
    }
  }

  // =========================================================================
  // 4.5 STRICT CLINICAL EMAIL VALIDATOR
  // =========================================================================
  function isValidClinicalEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const cleanEmail = email.trim();
    // Requires valid username, @ symbol, domain name, and minimum 2-letter TLD (e.g. .com, .org, .gov.bd)
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(cleanEmail)) return false;
    const parts = cleanEmail.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1];
    if (!domain.includes('.') || domain.endsWith('.')) return false;
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) return false;
    return true;
  }

  // =========================================================================
  // 5. LOGIN ACTION (Direct Authentication -> Redirect to Dashboard)
  // =========================================================================
  async function handleLogin(e) {
    if (e) e.preventDefault();
    const submitBtn = document.getElementById('btnSubmitLogin');
    const errBox = document.getElementById('loginErrorMsg');
    if (errBox) {
      errBox.style.display = 'none';
      errBox.textContent = '';
    }

    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
      if (errBox) {
        errBox.textContent = 'Please enter both email/username and password.';
        errBox.style.display = 'block';
      }
      return;
    }

    // Strict email check if user entered an email address format
    if (username.includes('@') && !isValidClinicalEmail(username)) {
      if (errBox) {
        errBox.textContent = 'Please enter a complete and valid email address (e.g. name@hospital.gov.bd).';
        errBox.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.innerHTML = '<span>Verifying credentials...</span> <i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i>';
      submitBtn.disabled = true;
    }

    try {
      const res = await fetch('../api/auth/session.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password })
      });
      const data = await res.json();
      
      if (res.ok && data && (data.success || data.ok)) {
        sessionStorage.setItem('auth_user', JSON.stringify(data.data?.user || { username, full_name: 'Dr. S. Jenkins, MD', authenticated: true }));
        window.location.href = 'patients.html';
      } else {
        if (errBox) {
          errBox.textContent = data.message || data.error || 'Invalid credentials. Please verify and try again.';
          errBox.style.display = 'block';
        }
        if (submitBtn) {
          submitBtn.innerHTML = '<span>Login</span> <i class="ri-login-box-line"></i>';
          submitBtn.disabled = false;
        }
      }
    } catch (err) {
      if (errBox) {
        errBox.textContent = 'Unable to reach authentication server. Please check connection.';
        errBox.style.display = 'block';
      }
      if (submitBtn) {
        submitBtn.innerHTML = '<span>Login</span> <i class="ri-login-box-line"></i>';
        submitBtn.disabled = false;
      }
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  const btnSubmitLogin = document.getElementById('btnSubmitLogin');
  if (btnSubmitLogin) {
    btnSubmitLogin.addEventListener('click', (e) => {
      handleLogin(e);
    });
  }

  // =========================================================================
  // 6. FORGOT PASSWORD ACTION (Prompts for Email -> Dispatches OTP)
  // =========================================================================
  const forgotModalOverlay   = document.getElementById('forgotModalOverlay');
  const forgotCard           = document.getElementById('forgotCard');
  const btnCloseForgotModal  = document.getElementById('btnCloseForgotModal');
  const btnCancelForgotModal = document.getElementById('btnCancelForgotModal');
  const forgotPasswordForm   = document.getElementById('forgotPasswordForm');
  const forgotEmailInput     = document.getElementById('forgotEmailInput');
  const forgotErrorMsg       = document.getElementById('forgotErrorMsg');

  function openForgotModal() {
    if (!forgotModalOverlay) return;
    forgotModalOverlay.style.opacity = '1';
    forgotModalOverlay.style.pointerEvents = 'auto';
    if (forgotCard) forgotCard.style.transform = 'scale(1)';

    if (forgotErrorMsg) {
      forgotErrorMsg.style.display = 'none';
      forgotErrorMsg.textContent = '';
    }

    // Pre-populate if user had already typed an email into the login field
    const currentInput = document.getElementById('loginUsername')?.value.trim();
    if (forgotEmailInput) {
      if (currentInput && currentInput.includes('@')) {
        forgotEmailInput.value = currentInput;
      } else {
        forgotEmailInput.value = '';
      }
      setTimeout(() => forgotEmailInput.focus(), 150);
    }
  }

  function closeForgotModal() {
    if (!forgotModalOverlay) return;
    forgotModalOverlay.style.opacity = '0';
    forgotModalOverlay.style.pointerEvents = 'none';
    if (forgotCard) forgotCard.style.transform = 'scale(0.94)';
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      openForgotModal();
    });
  }

  if (btnCloseForgotModal)  btnCloseForgotModal.addEventListener('click', closeForgotModal);
  if (btnCancelForgotModal) btnCancelForgotModal.addEventListener('click', closeForgotModal);

  if (forgotModalOverlay) {
    forgotModalOverlay.addEventListener('click', (e) => {
      if (e.target === forgotModalOverlay) closeForgotModal();
    });
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = forgotEmailInput ? forgotEmailInput.value.trim() : '';

      // Validate email format strictly
      if (!isValidClinicalEmail(email)) {
        if (forgotErrorMsg) {
          forgotErrorMsg.textContent = 'Please enter a complete and valid email address (e.g. name@hospital.gov.bd or user@gmail.com).';
          forgotErrorMsg.style.display = 'block';
        }
        return;
      }

      const submitBtn = document.getElementById('btnSubmitForgot');
      if (submitBtn) {
        submitBtn.innerHTML = '<span>Dispatching OTP...</span> <i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i>';
        submitBtn.disabled = true;
      }

      // Smoothly navigate to OTP verification vault for this specific email
      setTimeout(() => {
        window.location.href = `otp.html?action=forgot_password&email=${encodeURIComponent(email)}`;
      }, 350);
    });
  }

  // =========================================================================
  // 7. REGISTRATION ACTION (Takes user directly to OTP Page)
  // =========================================================================
  function handleRegistration(e) {
    if (e) e.preventDefault();
    const submitBtn = document.getElementById('btnSubmitRegister');
    const regErrBox = document.getElementById('regErrorMsg');
    if (regErrBox) {
      regErrBox.style.display = 'none';
      regErrBox.textContent = '';
    }
    
    const nameInput = document.getElementById('regUsername');
    const emailInput = document.getElementById('regEmail');
    const passInput = document.getElementById('regPassword');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value : '';

    if (!name || !email || !password) {
      if (regErrBox) {
        regErrBox.textContent = 'Please complete all registration fields.';
        regErrBox.style.display = 'block';
      }
      return;
    }

    if (!isValidClinicalEmail(email)) {
      if (regErrBox) {
        regErrBox.textContent = 'Please enter a complete and valid email address (e.g. name@hospital.gov.bd or user@gmail.com).';
        regErrBox.style.display = 'block';
      }
      return;
    }

    if (password.length < 6) {
      if (regErrBox) {
        regErrBox.textContent = 'Password must be at least 6 characters long.';
        regErrBox.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.innerHTML = '<span>Dispatching OTP...</span> <i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i>';
      submitBtn.disabled = true;
    }

    sessionStorage.setItem('pending_registration', JSON.stringify({ name, email, password }));
    
    // Smoothly redirect to dedicated OTP verification page
    window.location.href = `otp.html?action=register&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;
  }

  if (registerForm) {
    registerForm.addEventListener('submit', handleRegistration);
  }

  const btnSubmitRegister = document.getElementById('btnSubmitRegister');
  if (btnSubmitRegister) {
    btnSubmitRegister.addEventListener('click', (e) => {
      handleRegistration(e);
    });
  }
});
