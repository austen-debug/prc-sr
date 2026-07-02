// PRC GATE access-control validation
// Client-side UI/UX guard layer for instructor-only actions. Styles live in /css/prc-dash-modal-systems.css.
(function () {
  let started = false;
  let passScheduled = false;

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
    passScheduled = false;
    patchShowPage();
    GUARDED_FUNCTIONS.forEach(guardFunction);
    enforcePageAccess();
    normalizeInstructorHints();
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(runPass);
  }

  function observeAccessTargets() {
    const observer = new MutationObserver(schedulePass);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'onclick', 'oncontextmenu']
    });
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('submit', blockInstructorOnlySubmit, true);
    document.addEventListener('click', event => {
      blockInstructorOnlyClick(event);
      schedulePass();
    }, true);
    document.addEventListener('contextmenu', blockInstructorOnlyContextMenu, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') schedulePass();
    }, true);
    window.addEventListener('resize', schedulePass, true);
    observeAccessTargets();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
