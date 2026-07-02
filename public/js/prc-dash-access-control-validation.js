// PRC GATE access-control validation
// Client-side UI/UX guard layer for instructor-only actions. Does not change auth/session/API behavior.
(function () {
  let started = false;
  let stylesReady = false;

  const INSTRUCTOR_PAGES = new Set(['airport', 'input', 'archives']);
  const GUARDED_FUNCTIONS = [
    'openDorm',
    'closeDorm',
    'openDormEditModal',
    'deleteDormitoryFromEditModal',
    'openArchiveEditModal',
    'deleteArchiveWithOverride',
    'printArchiveSpreadsheet',
    'initiateCloseout',
    'openAirportBusEditModal'
  ];

  function currentRoleSafe() {
    try { return currentRole || 'airman'; } catch (_) { return 'airman'; }
  }

  function isInstructor() {
    return currentRoleSafe() === 'instructor';
  }

  function ensureStyles() {
    if (stylesReady || document.getElementById('prc-gate-access-control-styles')) return;
    const style = document.createElement('style');
    style.id = 'prc-gate-access-control-styles';
    style.textContent = `
      .gate-access-denied-toast {
        position: fixed !important;
        left: 50% !important;
        bottom: 1.25rem !important;
        transform: translateX(-50%) !important;
        z-index: calc(var(--z-modal-window, 600) + 80) !important;
        max-width: min(92vw, 420px) !important;
        padding: 0.72rem 0.92rem !important;
        border: 1px solid rgba(248, 113, 113, 0.44) !important;
        border-radius: var(--radius-lg, 18px) !important;
        background: rgba(127, 29, 29, 0.86) !important;
        color: #fff !important;
        box-shadow: var(--gate-shadow-strong, 0 20px 44px rgba(0,0,0,0.34)) !important;
        -webkit-backdrop-filter: blur(18px) saturate(1.18) !important;
        backdrop-filter: blur(18px) saturate(1.18) !important;
        font-size: 0.78rem !important;
        font-weight: 900 !important;
        line-height: 1.18 !important;
        letter-spacing: 0.055em !important;
        text-align: center !important;
        text-transform: uppercase !important;
      }

      body.gate-airman-role #page-airport,
      body.gate-airman-role #page-input,
      body.gate-airman-role #page-archives,
      body.gate-airman-role #closeout-btn,
      body.gate-airman-role #airport-bus-edit-modal,
      body.gate-airman-role #dorm-edit-modal,
      body.gate-airman-role #archive-edit-modal,
      body.gate-airman-role #gate-processing-context-menu {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    stylesReady = true;
  }

  function showDenied(message = 'Instructor access required.') {
    let toast = document.getElementById('gate-access-denied-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'gate-access-denied-toast';
      toast.className = 'gate-access-denied-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toast.__hideTimer);
    toast.__hideTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
  }

  function closeInstructorModals() {
    ['dorm-edit-modal', 'archive-edit-modal', 'airport-bus-edit-modal', 'gate-processing-context-menu'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    try { editDormId = null; } catch (_) {}
    try { editArchiveId = null; } catch (_) {}
    try { editBusId = null; } catch (_) {}
  }

  function enforcePageAccess() {
    document.body.classList.toggle('gate-airman-role', !isInstructor());
    document.body.classList.toggle('gate-instructor-role', isInstructor());

    if (isInstructor()) return;

    closeInstructorModals();

    const activePage = document.querySelector('.page.active');
    const pageId = activePage ? activePage.id.replace('page-', '') : '';
    if (INSTRUCTOR_PAGES.has(pageId)) {
      if (typeof showPage === 'function') showPage('board');
      else {
        activePage.classList.remove('active');
        document.getElementById('page-board')?.classList.add('active');
      }
    }
  }

  function guardFunction(name) {
    let fn;
    try { fn = window[name] || eval(name); } catch (_) { fn = window[name]; }
    if (typeof fn !== 'function') return;
    if (fn.__gateAccessGuarded === true) return;

    const guarded = function guardedInstructorAction(...args) {
      if (!isInstructor()) {
        const event = args.find(arg => arg && typeof arg.preventDefault === 'function');
        if (event) {
          event.preventDefault();
          event.stopPropagation?.();
          event.stopImmediatePropagation?.();
        }
        showDenied('Instructor access required for this action.');
        enforcePageAccess();
        return undefined;
      }
      return fn.apply(this, args);
    };

    guarded.__gateAccessGuarded = true;
    guarded.__gateOriginal = fn;
    window[name] = guarded;
    try { eval(`${name} = window[${JSON.stringify(name)}]`); } catch (_) {}
  }

  function patchShowPage() {
    let fn;
    try { fn = window.showPage || showPage; } catch (_) { fn = window.showPage; }
    if (typeof fn !== 'function' || fn.__gatePageGuarded === true) return;

    const guarded = function guardedShowPage(id, ...rest) {
      if (!isInstructor() && INSTRUCTOR_PAGES.has(id)) {
        showDenied('Instructor access required for that page.');
        return fn.call(this, 'board', ...rest);
      }
      return fn.call(this, id, ...rest);
    };

    guarded.__gatePageGuarded = true;
    guarded.__gateOriginal = fn;
    window.showPage = guarded;
    try { showPage = guarded; } catch (_) {}
  }

  function blockInstructorOnlySubmit(event) {
    if (isInstructor()) return;
    const form = event.target;
    if (!form || !form.id) return;

    const guardedForms = new Set([
      'dorm-edit-form',
      'archive-edit-form',
      'airport-bus-edit-form',
      'batch-form',
      'local-bus-form'
    ]);

    if (!guardedForms.has(form.id)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    showDenied('Instructor access required for this update.');
    enforcePageAccess();
  }

  function blockInstructorOnlyClick(event) {
    if (isInstructor()) return;

    const target = event.target;
    if (!target?.closest) return;

    const guardedTarget = target.closest([
      '#closeout-btn',
      '#page-airport button',
      '#page-input button',
      '#page-archives button',
      '#airport-bus-log-body tr[onclick]',
      '#archive-history [oncontextmenu]',
      '#archive-edit-modal button',
      '#dorm-edit-modal button',
      '#airport-bus-edit-modal button',
      '#gate-processing-context-menu button'
    ].join(','));

    if (!guardedTarget) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    showDenied('Instructor access required for this control.');
    enforcePageAccess();
  }

  function blockInstructorOnlyContextMenu(event) {
    if (isInstructor()) return;
    const target = event.target;
    if (!target?.closest) return;

    const guardedTarget = target.closest('#page-processing .proc-card, #archive-history [oncontextmenu]');
    if (!guardedTarget) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    showDenied('Instructor access required for right-click actions.');
    enforcePageAccess();
  }

  function normalizeInstructorHints() {
    const processingHint = document.getElementById('processing-edit-hint');
    if (processingHint) processingHint.classList.toggle('hidden', !isInstructor());

    document.querySelectorAll('#archive-history [oncontextmenu]').forEach(card => {
      if (isInstructor()) {
        card.style.cursor = 'pointer';
        card.title = 'Right-click to edit archived week group';
      } else {
        card.style.cursor = 'default';
        card.title = 'Archived week group';
      }
    });
  }

  function runPass() {
    ensureStyles();
    patchShowPage();
    GUARDED_FUNCTIONS.forEach(guardFunction);
    enforcePageAccess();
    normalizeInstructorHints();
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('submit', blockInstructorOnlySubmit, true);
    document.addEventListener('click', blockInstructorOnlyClick, true);
    document.addEventListener('contextmenu', blockInstructorOnlyContextMenu, true);
    runPass();
    setInterval(runPass, 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
