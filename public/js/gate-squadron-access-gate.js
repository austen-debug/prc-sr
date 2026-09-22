(() => {
  'use strict';

  const ACK_KEY = 'gate-squadron-access-acknowledged';
  const SESSION_MARKER = document.querySelector('meta[name="gate-auth-session"]')?.content || '';
  const page = document.getElementById('page-squadron');
  if (!document.body.classList.contains('gate-squadron-standalone') || !page) return;

  const stored = key => {
    try { return window.sessionStorage?.getItem(key) || ''; } catch { return ''; }
  };
  const store = (key, value) => {
    try { window.sessionStorage?.setItem(key, value); } catch (_) {}
  };

  if (SESSION_MARKER && stored(ACK_KEY) === SESSION_MARKER) return;

  document.body.classList.add('gate-squadron-access-pending');
  page.setAttribute('aria-hidden', 'true');
  page.inert = true;

  const overlay = document.createElement('div');
  overlay.id = 'squadron-access-gate';
  overlay.className = 'gate-squadron-access-gate';
  overlay.innerHTML = `
    <section class="gate-squadron-access-card" role="dialog" aria-modal="true" aria-labelledby="squadron-access-title" aria-describedby="squadron-access-copy">
      <div class="gate-squadron-access-kicker">GATE TESTING NOTICE</div>
      <h2 id="squadron-access-title">Attention:</h2>
      <div id="squadron-access-copy" class="gate-squadron-access-copy">
        <p>The Gateway Arrival Tracking Environment (GATE) is currently in testing. All current Group processing still remain. Squadrons will be notified of Dorm status via their Charge of Quarters. <strong>DO NOT INPUT CUI / OR PII information into this system.</strong></p>
        <p>If you have been given access to GATE for testing, you agree to reserve access and not disseminate usernames and passwords.</p>
        <p><strong>You are accessing a U.S. Government (USG) Information System (IS) that is provided for USG-authorized use only. By using this information system, you consent to the following conditions:</strong></p>
        <ul>
          <li><strong>The USG routinely monitors, records, and audits actions on this system.</strong></li>
          <li><strong>Unauthorized use of this system is strictly prohibited and subject to criminal and civil penalties.</strong></li>
          <li><strong>You have no reasonable expectation of privacy regarding any communication or data transiting or stored on this system.</strong></li>
        </ul>
      </div>
      <div class="gate-squadron-access-actions">
        <button id="squadron-access-cancel" type="button" class="gate-squadron-access-cancel">Cancel</button>
        <button id="squadron-access-agree" type="button" class="gate-squadron-access-agree">Agree &amp; Continue</button>
      </div>
    </section>`;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) event.preventDefault();
  });

  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  document.getElementById('squadron-access-agree')?.addEventListener('click', () => {
    if (SESSION_MARKER) store(ACK_KEY, SESSION_MARKER);
    page.inert = false;
    page.removeAttribute('aria-hidden');
    document.body.classList.remove('gate-squadron-access-pending');
    overlay.remove();
    document.getElementById('squadron-information')?.focus();
  });

  document.getElementById('squadron-access-cancel')?.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (_) {}
    window.location.replace('/login/');
  });

  document.getElementById('squadron-access-agree')?.focus();
})();