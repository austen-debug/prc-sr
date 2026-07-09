// GATE Phase 1A Permission Guard
// Protects role-limited actions only. Routing and navigation are owned by GateAppShell.
(function () {
  'use strict';

  const ROLE_PAGES = Object.freeze({
    instructor: ['board', 'airport', 'input', 'processing', 'archives', 'squadron'],
    airman: ['board', 'processing'],
    squadron: ['squadron']
  });

  const INSTRUCTOR_ONLY_FUNCTIONS = [
    'openDorm',
    'closeDorm',
    'openDormEditModal',
    'deleteDormitoryFromEditModal',
    'openArchiveEditModal',
    'deleteArchiveWithOverride',
    'initiateCloseout',
    'openAirportBusEditModal',
    'printArchiveSpreadsheet',
    'printCurrentSummaryReport',
    'initializeWeekGroup',
    'updateFlightTime'
  ];

  const AIRMAN_ALLOWED_FORMS = new Set(['local-bus-form']);
  const INSTRUCTOR_ONLY_FORMS = new Set([
    'airport-form',
    'airport-bus-edit-form',
    'archive-edit-form',
    'dorm-edit-form'
  ]);

  let installed = false;
  let hooksRegistered = false;
  let passQueued = false;

  function currentRoleSafe() {
    try { return currentRole || 'airman'; } catch (_) { return 'airman'; }
  }

  function isInstructor() {
    return currentRoleSafe() === 'instructor';
  }

  function allowedPagesForRole(role = currentRoleSafe()) {
    return ROLE_PAGES[role] || ROLE_PAGES.airman;
  }

  function firstAllowedPage(role = currentRoleSafe()) {
    return allowedPagesForRole(role)[0] || 'board';
  }

  function pageIsAllowed(page, role = currentRoleSafe()) {
    return allowedPagesForRole(role).includes(String(page || '').replace(/^page-/, ''));
  }

  function activePageId() {
    const activePage = document.querySelector('.page.active');
    return activePage ? activePage.id.replace(/^page-/, '') : '';
  }

  function toast(message = 'Instructor access required.') {
    let element = document.getElementById('gate-access-denied-toast');
    if (!element) {
      element = document.createElement('div');
      element.id = 'gate-access-denied-toast';
      element.className = 'gate-access-denied-toast hidden';
      element.setAttribute('role', 'status');
      element.setAttribute('aria-live', 'polite');
      document.body.appendChild(element);
    }

    element.textContent = message;
    element.classList.remove('hidden');
    clearTimeout(element.__gateHideTimer);
    element.__gateHideTimer = setTimeout(() => element.classList.add('hidden'), 2400);
  }

  function closeProtectedSurfaces() {
    if (isInstructor()) return;

    ['dorm-edit-modal', 'archive-edit-modal', 'airport-bus-edit-modal', 'gate-processing-context-menu'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.classList.add('hidden');
    });

    try { editDormId = null; } catch (_) {}
    try { editArchiveId = null; } catch (_) {}
    try { editBusId = null; } catch (_) {}
  }

  function setBodyRoleState() {
    const role = currentRoleSafe();
    document.body.dataset.gateRole = role;
    document.body.classList.toggle('gate-instructor-role', role === 'instructor');
    document.body.classList.toggle('gate-airman-role', role === 'airman');
    document.body.classList.toggle('gate-squadron-role', role === 'squadron');
  }

  function routeToAllowedPageIfNeeded() {
    const active = activePageId();
    if (!active || pageIsAllowed(active)) return;

    const fallback = firstAllowedPage();
    if (window.GateAppShell?.go) {
      window.GateAppShell.go(fallback);
      return;
    }

    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const target = document.getElementById(`page-${fallback}`);
    if (target) target.classList.add('active');
  }

  function applyVisibility() {
    setBodyRoleState();

    const instructor = isInstructor();
    const role = currentRoleSafe();

    document.querySelectorAll('[data-page]').forEach(element => {
      const page = element.dataset.page;
      element.toggleAttribute('aria-disabled', !pageIsAllowed(page));
    });

    const closeoutButton = document.getElementById('closeout-btn');
    if (closeoutButton) closeoutButton.style.display = instructor ? '' : 'none';

    const processingEditHint = document.getElementById('processing-edit-hint');
    if (processingEditHint) processingEditHint.classList.toggle('hidden', !instructor);

    document.querySelectorAll('#page-airport, #page-input, #page-archives').forEach(page => {
      page.dataset.permission = instructor ? 'allowed' : 'instructor-only';
    });

    const localBusButton = Array.from(document.querySelectorAll('button')).find(button => /add local bus/i.test(button.textContent || ''));
    if (localBusButton) {
      localBusButton.style.display = role === 'squadron' ? 'none' : '';
      localBusButton.dataset.permission = role === 'airman' || instructor ? 'allowed' : 'restricted';
    }

    document.querySelectorAll('#archive-history [oncontextmenu]').forEach(card => {
      card.style.cursor = instructor ? 'pointer' : 'default';
      card.title = instructor ? 'Right-click to edit archived week group' : 'Archived week group';
      card.dataset.permission = instructor ? 'editable' : 'read-only';
    });

    if (!instructor) closeProtectedSurfaces();
    routeToAllowedPageIfNeeded();
  }

  function protectFunction(name) {
    const fn = window[name];
    if (typeof fn !== 'function' || fn.__gatePermissionGuard === true) return;

    const protectedFunction = function gateProtectedInstructorFunction(...args) {
      if (!isInstructor()) {
        const event = args.find(arg => arg && typeof arg.preventDefault === 'function');
        if (event) {
          event.preventDefault();
          event.stopPropagation?.();
          event.stopImmediatePropagation?.();
        }
        toast('Instructor access required for this action.');
        schedulePass();
        return undefined;
      }
      return fn.apply(this, args);
    };

    protectedFunction.__gatePermissionGuard = true;
    protectedFunction.__gateOriginal = fn;
    window[name] = protectedFunction;
  }

  function guardedFormSubmit(event) {
    const form = event.target;
    if (!form || !form.id) return;

    if (isInstructor()) return;
    if (AIRMAN_ALLOWED_FORMS.has(form.id) && currentRoleSafe() === 'airman') return;

    if (INSTRUCTOR_ONLY_FORMS.has(form.id) || form.closest('#page-airport, #page-input, #page-archives, #dorm-edit-modal, #archive-edit-modal, #airport-bus-edit-modal')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      toast('Instructor access required for this update.');
      schedulePass();
    }
  }

  function guardedClick(event) {
    if (isInstructor()) return;

    const target = event.target;
    if (!target?.closest) return;

    if (currentRoleSafe() === 'squadron') {
      const allowed = target.closest('#page-squadron, #main-nav-menu, #nav-links, #role-toggle, #mobile-menu-trigger, #sound-toggle-btn, #theme-toggle-btn, #fullscreen-btn');
      if (!allowed) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        toast('Squadron access is limited to Squadron Board.');
        schedulePass();
      }
      return;
    }

    const protectedTarget = target.closest([
      '#closeout-btn',
      '#init-wg-btn',
      '#page-airport button',
      '#page-input button',
      '#page-archives button',
      '#airport-bus-log-body tr[data-component="editable-bus-row"]',
      '#archive-history [oncontextmenu]',
      '#archive-edit-modal button',
      '#dorm-edit-modal button',
      '#airport-bus-edit-modal button',
      '#gate-processing-context-menu button'
    ].join(','));

    if (!protectedTarget) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    toast('Instructor access required for this control.');
    schedulePass();
  }

  function guardedContextMenu(event) {
    if (isInstructor()) return;

    const target = event.target;
    if (!target?.closest) return;

    const protectedTarget = target.closest('#page-processing .proc-card, #archive-history [oncontextmenu], #page-squadron .gate-dorm-card');
    if (!protectedTarget) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    toast('Instructor access required for right-click actions.');
    schedulePass();
  }

  function enforce() {
    INSTRUCTOR_ONLY_FUNCTIONS.forEach(protectFunction);
    applyVisibility();
  }

  function schedulePass() {
    if (passQueued) return;
    passQueued = true;
    window.requestAnimationFrame(() => {
      passQueued = false;
      enforce();
    });
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', schedulePass);
    window.registerGateHook('afterPageChange', schedulePass);
    window.registerGateHook('afterDataChanged', schedulePass);
    window.registerGateHook('afterModalOpen', schedulePass);
    hooksRegistered = true;
  }

  function start() {
    if (!installed) {
      document.addEventListener('submit', guardedFormSubmit, true);
      document.addEventListener('click', guardedClick, true);
      document.addEventListener('contextmenu', guardedContextMenu, true);
      document.addEventListener('keydown', event => { if (event.key === 'Escape') schedulePass(); }, true);
      installed = true;
    }

    registerHooksOnce();
    schedulePass();

    window.GatePermissionGuard = Object.freeze({
      role: currentRoleSafe,
      isInstructor,
      allowedPagesForRole,
      pageIsAllowed,
      enforce: schedulePass
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
