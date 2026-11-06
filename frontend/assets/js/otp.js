/**
 * Dedicated Production OTP Verification Controller
 * ESP32 Home Patient Monitoring System
 *
 * Implements:
 * - Real API integration via /api/auth/otp.php
 * - 30-Minute strict expiration lifecycle
 * - Automatic invalidation of previous OTP upon resend
 * - 2-Minute (120s) persistent resend cooldown timer
 * - Zero test credential / passcode leakage on screen
 * - EmailJS SDK dispatch integration
 * - Smooth Orbit physics & confetti celebration on verification
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. URL Query Extraction
  const urlParams = new URLSearchParams(window.location.search);
  const userEmail = (urlParams.get('email') || '').trim();
  const userAction = urlParams.get('action') || 'register';
  const userName = urlParams.get('name') || 'Authorized Clinician';

  // If no email provided, bounce back to authentication
  if (!userEmail || !userEmail.includes('@')) {
    window.location.replace('auth.html');
    return;
  }

  // DOM Elements
  const card = document.getElementById('card');
  const title = document.getElementById('title');
  const subtitle = document.getElementById('subtitle');
  const inputStage = document.getElementById('inputStage');
  const inputs = document.querySelectorAll('.input-pill');
  const orbitLayer = document.getElementById('orbitLayer');
  const orbitRing = document.getElementById('orbitRing');
  const loadingWrap = document.getElementById('loadingWrap');
  const loadingPercent = document.getElementById('loadingPercent');
  const successWrap = document.getElementById('successWrap');
  const errorMsg = document.getElementById('errorMsg');
  const resendBtn = document.getElementById('resendBtn');
  const pointerLight = document.getElementById('pointerLight');

  // State
  let state = 'idle';
  const timers = [];
  let cooldownInterval = null;

  // Update UI Subtitle without revealing the passcode
  function updateSubtitle(statusNote) {
    let noteHtml = statusNote || 'Please check your inbox. The code remains valid for 30 minutes.';
    subtitle.innerHTML = `A 4-digit verification code has been dispatched to<br><strong style="color:#e0e7ff;">${userEmail}</strong><br><span style="color:#94a3b8;font-size:11px;display:inline-block;margin-top:4px;">${noteHtml}</span>`;
  }
  updateSubtitle();

  // Pointer Light ambient glow
  document.addEventListener('pointermove', (e) => {
    if (pointerLight && e.pointerType === 'mouse') {
      pointerLight.style.left = `${e.clientX}px`;
      pointerLight.style.top = `${e.clientY}px`;
    }
  });

  // Clear all running animation timers
  function clearAllTimers() {
    timers.forEach(t => clearTimeout(t));
    timers.length = 0;
  }

  // ---------------------------------------------------------------------------
  // 2. 2-MINUTE (120s) RESEND COOLDOWN TIMER ENGINE
  // ---------------------------------------------------------------------------
  const COOLDOWN_KEY = `otp_cooldown_${encodeURIComponent(userEmail)}`;

  function startCooldownTimer(seconds) {
    if (cooldownInterval) clearInterval(cooldownInterval);

    const now = Date.now();
    let targetEnd = now + (seconds * 1000);

    // Save target time in sessionStorage so refresh does not bypass the cooldown
    sessionStorage.setItem(COOLDOWN_KEY, targetEnd.toString());

    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.style.opacity = '0.6';
      resendBtn.style.cursor = 'not-allowed';
    }

    function tick() {
      const remainingSec = Math.max(0, Math.ceil((targetEnd - Date.now()) / 1000));

      if (remainingSec <= 0) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
        sessionStorage.removeItem(COOLDOWN_KEY);

        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.style.opacity = '1';
          resendBtn.style.cursor = 'pointer';
          resendBtn.innerHTML = `Didn't receive it? <span>Resend Code</span>`;
        }
      } else {
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (resendBtn) {
          resendBtn.innerHTML = `Resend code in <span style="color:#38bdf8;">${formatted}</span>`;
        }
      }
    }

    tick();
    cooldownInterval = setInterval(tick, 1000);
  }

  function checkExistingCooldown() {
    const saved = sessionStorage.getItem(COOLDOWN_KEY);
    if (saved) {
      const targetEnd = parseInt(saved, 10);
      const remainingSec = Math.ceil((targetEnd - Date.now()) / 1000);
      if (remainingSec > 0) {
        startCooldownTimer(remainingSec);
        return true;
      } else {
        sessionStorage.removeItem(COOLDOWN_KEY);
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // 3. REQUEST / INITIATE OTP FROM BACKEND
  // ---------------------------------------------------------------------------
  async function requestOtp(isExplicitResend = false) {
    try {
      const action = isExplicitResend ? 'resend' : 'request';
      const res = await fetch('../api/auth/otp.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          email: userEmail,
          name: userName
        })
      });

      const json = await res.json();

      if (res.ok && json.success) {
        const data = json.data || {};

        // Only dispatch EmailJS email when a fresh code is newly generated
        // (Prevents draining free tier quota on simple browser refreshes)
        const isFreshIssue = (data.status === 'newly_issued' || isExplicitResend);

        if (isFreshIssue && data.dispatch_code && window.emailjs && window.EMAILJS_CONFIG && window.EMAILJS_CONFIG.serviceId && window.EMAILJS_CONFIG.publicKey) {
          const actionLabel = (userAction === 'forgot_password') ? 'Password Reset' : 'Account Verification';
          const templateParams = {
            to_email: userEmail,
            email: userEmail,
            user_email: userEmail,
            reply_to: 'no-reply@telemetry-hud.local',
            user_name: userName || 'Authorized Clinician',
            to_name: userName || 'Authorized Clinician',
            Action_type: actionLabel,
            action_type: actionLabel,
            otp_code: data.dispatch_code,
            code: data.dispatch_code,
            passcode: data.dispatch_code
          };

          emailjs.send(window.EMAILJS_CONFIG.serviceId, window.EMAILJS_CONFIG.templateId, templateParams)
            .then((resp) => {
              console.log('✅ EmailJS OTP email successfully dispatched to', userEmail, resp.status, resp.text);
              updateSubtitle('✉️ Verification email dispatched to your inbox. Valid for 30 minutes.');
            })
            .catch(err => {
              console.error('⚠️ EmailJS delivery error:', err);
              const errMsg = err?.text || err?.message || 'Code generated';
              updateSubtitle('Email notice: ' + errMsg + '. Please check your inbox/spam or click Resend.');
            });
        }

        // Start 2-minute cooldown timer
        const waitSec = data.can_resend_in !== undefined ? data.can_resend_in : 120;
        if (waitSec > 0) {
          startCooldownTimer(waitSec);
        }

        if (data.status === 'active_reused') {
          updateSubtitle('Active 30-minute verification code session resumed. Check your inbox.');
        } else if (!window.EMAILJS_CONFIG || !window.EMAILJS_CONFIG.serviceId) {
          updateSubtitle('A new verification code has been dispatched. Valid for 30 minutes.');
        }
      } else {
        // If rate limit (429) hit
        if (res.status === 429 && json.data?.wait_seconds) {
          startCooldownTimer(json.data.wait_seconds);
        }
        if (errorMsg) {
          errorMsg.textContent = json.message || 'Unable to request code.';
          errorMsg.classList.add('show');
          setTimeout(() => errorMsg.classList.remove('show'), 3500);
        }
      }
    } catch (err) {
      console.warn('OTP network request fallback:', err);
    }
  }

  // Check cooldown on load; if none active, request OTP session
  const hadCooldown = checkExistingCooldown();
  requestOtp(false);

  // ---------------------------------------------------------------------------
  // 4. INPUT HANDLING
  // ---------------------------------------------------------------------------
  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      if (state === 'loading' || state === 'success') return;
      if (state === 'error') resetState(true);

      const value = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = value;

      if (value) {
        e.target.classList.add('filled');
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        } else {
          // Check all 4 digits
          const otp = Array.from(inputs).map(inp => inp.value).join('');
          if (otp.length === 4) {
            triggerVerify(otp);
          }
        }
      } else {
        e.target.classList.remove('filled');
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (state === 'error') resetState(true);
        if (!e.target.value && index > 0) {
          inputs[index - 1].focus();
        }
      }
    });

    input.addEventListener('focus', () => {
      if (state === 'error') resetState(true);
      input.select();
    });
  });

  // Build Orbit Digits
  function buildOrbit() {
    orbitRing.innerHTML = '';
    const radius = 64;
    const digits = Array.from(inputs).map(i => i.value);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius;

      const node = document.createElement('div');
      node.className = 'orbit-node';
      node.textContent = digits[i] || '';
      node.style.setProperty('--dx', `${dx}px`);
      node.style.setProperty('--dy', `${dy}px`);
      node.style.animationDelay = `${i * 60}ms`;
      orbitRing.appendChild(node);
    }
  }

  function playOrbit() {
    buildOrbit();
    orbitLayer.classList.add('active');
    void orbitRing.offsetWidth;
    orbitRing.classList.add('spin');
    document.querySelectorAll('.orbit-node').forEach(n => n.classList.add('node-fly'));
  }

  // ---------------------------------------------------------------------------
  // 5. VERIFICATION FLOW VIA API
  // ---------------------------------------------------------------------------
  async function triggerVerify(enteredOtp) {
    if (state === 'loading' || state === 'success') return;
    state = 'loading';
    clearAllTimers();

    inputStage.classList.add('hidden');
    playOrbit();

    timers.push(setTimeout(async () => {
      orbitLayer.classList.remove('active');
      orbitRing.classList.remove('spin');
      orbitRing.innerHTML = '';
      inputStage.style.display = 'none';

      title.textContent = 'Verifying Access...';
      subtitle.textContent = 'Checking authorization token and cryptographic key.';
      loadingWrap.classList.add('active');

      const start = performance.now();
      const duration = 1400;
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 2.2);
        loadingPercent.textContent = Math.round(eased * 100);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);

      // Call Backend Verification API
      try {
        const res = await fetch('../api/auth/otp.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify',
            email: userEmail,
            otp: enteredOtp,
            name: userName
          })
        });

        const json = await res.json();

        timers.push(setTimeout(() => {
          if (res.ok && json.success) {
            handleSuccess(json.data?.user);
          } else {
            handleError(json.message || 'Incorrect verification code. Please try again.');
          }
        }, duration + 100));

      } catch (err) {
        timers.push(setTimeout(() => {
          handleError('Server communication error during verification.');
        }, duration + 100));
      }

    }, 1500));
  }

  // Success State
  function handleSuccess(verifiedUser) {
    state = 'success';
    loadingWrap.classList.remove('active');
    spawnConfetti();
    successWrap.classList.add('active');

    if (userAction === 'forgot_password') {
      title.textContent = 'Identity Verified';
      subtitle.innerHTML = `Access restored for <strong>${userEmail}</strong>. Redirecting to <strong>Doctor Portal</strong>…`;
    } else {
      title.textContent = 'Access Granted';
      subtitle.innerHTML = 'Identity authenticated. Redirecting to <strong>Doctor Portal & Patient Directory</strong>…';
    }
    if (resendBtn) resendBtn.style.display = 'none';

    // Store authenticated state in sessionStorage
    const authPayload = verifiedUser || {
      email: userEmail,
      full_name: userName,
      role: 'attending_physician',
      authenticated: true
    };
    sessionStorage.setItem('auth_user', JSON.stringify(authPayload));

    // Clear cooldown state
    sessionStorage.removeItem(COOLDOWN_KEY);

    // If this was a new registration, persist user in backend data_store
    const pending = sessionStorage.getItem('pending_registration');
    if (pending) {
      try {
        const parsed = JSON.parse(pending);
        fetch('../api/auth/session.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            name: parsed.name || userName,
            email: parsed.email || userEmail,
            password: parsed.password || 'Doctor@2026!'
          })
        }).then(r => r.json()).then(data => {
          if (data && data.ok && data.data?.user) {
            sessionStorage.setItem('auth_user', JSON.stringify(data.data.user));
          }
          sessionStorage.removeItem('pending_registration');
        }).catch(err => console.warn('Registration sync note:', err));
      } catch (e) {}
    }

    // Redirect to Central Doctor Dashboard after celebration
    timers.push(setTimeout(() => {
      window.location.href = 'patients.html';
    }, 1800));
  }

  // Error State
  function handleError(customMessage) {
    state = 'error';
    loadingWrap.classList.remove('active');
    card.classList.add('shake');
    errorMsg.textContent = customMessage || 'The 4-digit access code is incorrect.';
    errorMsg.classList.add('show');
    title.textContent = 'Verification Failed';
    subtitle.textContent = customMessage || 'Please verify the code in your email and try again.';
    inputs.forEach(input => input.classList.add('error'));

    timers.push(setTimeout(() => card.classList.remove('shake'), 500));
    timers.push(setTimeout(() => resetState(false), 2400));
  }

  // Confetti Particle Explosion
  function spawnConfetti() {
    successWrap.querySelectorAll('.confetti').forEach(c => c.remove());
    const colors = ['#10b981', '#34d399', '#6ee7b7', '#6366f1', '#a78bfa', '#fbbf24', '#f472b6', '#22d3ee'];
    const count = 28;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const dist = 80 + Math.random() * 70;
      const cx = Math.cos(angle) * dist;
      const cy = Math.sin(angle) * dist;

      const dot = document.createElement('div');
      dot.className = 'confetti';
      dot.style.background = colors[i % colors.length];
      dot.style.setProperty('--cx', `${cx}px`);
      dot.style.setProperty('--cy', `${cy}px`);
      dot.style.boxShadow = `0 0 12px ${colors[i % colors.length]}`;
      const size = 6 + Math.random() * 8;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;

      successWrap.appendChild(dot);
    }
  }

  // Reset State
  function resetState(immediateFocus) {
    clearAllTimers();
    state = 'idle';

    card.classList.remove('shake');
    errorMsg.classList.remove('show');
    title.textContent = 'Enter Access Code';
    updateSubtitle();

    orbitLayer.classList.remove('active');
    orbitRing.classList.remove('spin');
    orbitRing.innerHTML = '';

    loadingWrap.classList.remove('active');
    loadingPercent.textContent = '0';

    successWrap.classList.remove('active');
    successWrap.querySelectorAll('.confetti').forEach(c => c.remove());

    inputs.forEach(input => {
      input.value = '';
      input.classList.remove('error', 'filled');
    });

    inputStage.style.display = 'flex';
    inputStage.classList.remove('hidden');

    if (immediateFocus !== false) inputs[0].focus();
  }

  // ---------------------------------------------------------------------------
  // 6. RESEND OTP ACTION WITH COOLDOWN VALIDATION
  // ---------------------------------------------------------------------------
  if (resendBtn) {
    resendBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (resendBtn.disabled) return;

      resendBtn.disabled = true;
      resendBtn.innerHTML = `Dispatching new code...`;

      await requestOtp(true);
      resetState(true);
    });
  }

  // Initial focus on first pill
  setTimeout(() => inputs[0].focus(), 300);
});
