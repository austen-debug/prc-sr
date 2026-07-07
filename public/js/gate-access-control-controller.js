// GATE Access Control Controller
// Canonical client-side owner for page routing, role-based UI visibility, and protected workflow controls.
(function () {
  'use strict';

  const ROLE_PAGES = Object.freeze({
    instructor: ['board', 'airport', 'input', 'processing', 'archives', 'squadron'],
    airman: ['board', 'processing'],
    squadron: ['squadron']
  });

  const PAGE_LABELS_FALLBACK = Object.freeze({
    board: 'Status Board',
    airport: 'Airport',
    input: 'Input',
    processing: 'Processing',
    archives: 'Archives',
    squadron: 'Squadron Board'
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
  let showPagePatched = false;
  let buildNavPatched = false;
  let roleVisibilityPatched = false;

  function role() {
    try { return currentRole || 'airman'; } catch (_) { return 'airman'; }
  }

  function isInstructor() {
    return role() === 'instructor';
  }

  function allowedPagesForRole(current = role()) {
    return ROLE_PAGES[current] || ROLE_PAGES.airman;
  }

  function firstAllowedPage(current = role()) {
    return allowedPagesForRole(current)[0] || 'board';
  }

  function pageIsAllowed(page, current = role()) {
    return allowedPagesForRole(current).includes(page);
  }

  function activePageId() {
    const activePage = document.querySelector('.page.active');
    return activePage ? activePage.id.replace(/^page-/, '') : '';
  }

  function pageLabel(page) {
    try {
      if (typeof PAGE_LABELS !== 'undefined' && PAGE_LABELS[page]) return PAGE_LABELS[page];
    } catch (_) {}
    return PAGE_LABELS_FALLBACK[page] || page;
  }

  function toast(message = 'Instructor access required.') {
    let el = document.getElementById('gate-access-denied-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gate-access-denied-toast';
      el.className = 'gate-access-denied-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }

    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(el.__gateHideTimer);
    el.__gateHideTimer = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  function closeProtectedSurfaces() {
    if (isInstructor()) return;

    ['dorm-edit-modal', 'archive-edit-modal', 'airport-bus-edit-modal', 'gate-processing-context-menu'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    try { editDormId = null; } catch (_) {}
    try { editArchiveId = null; } catch (_) {}
    try { editBusId = null; } catch (_) {}
  }

  function setBodyRoleState() {
    const current = role();
    document.body.dataset.gateRole = current;
    document.body.classList.toggle('gate-instructor-role', current === 'instructor');
    document.body.classList.toggle('gate-airman-role', current === 'airman');
    document.body.classList.toggle('gate-squadron-role', current === 'squadron');
  }

  function ensureSquadronPageIfNeeded() {
    if (document.getElementById('page-squadron')) return;
    if (typeof window.GateDormBoardController?.refresh === 'function') {
      window.GateDormBoardController.refresh();
      return;
    }
    if (typeof renderAll === 'function') {
      try { renderAll(); } catch (_) {}
    }
  }

  function navButtonMarkup(page, active) {
    if (typeof window.GateComponents?.navButton === 'function') {
      return window.GateComponents.navButton({ page, label: pageLabel(page), active });
    }
    return `<button type="button" class="nav-btn ${active ? 'active' : ''}" data-page="${page}" onclick="showPage('${page}')">${pageLabel(page)}</button>`;
  }

  function renderAccessAwareNav() {
    const container = document.getElementById('main-nav-menu') || document.getElementById('nav-links');
    if (!container) return;

    ensureSquadronPageIfNeeded();
    const pages = allowedPagesForRole();
    const active = activePageId() || firstAllowedPage();
    container.innerHTML = pages.map(page => navButtonMarkup(page, page === active)).join('');
    container.dataset.owner = 'gate-access-control-controller';
    container.dataset.role = role();

    const roleButton = document.getElementById('role-toggle');
    if (roleButton) {
      const label = role() === 'instructor' ? 'INSTRUCTOR / LOGOUT' : (role() === 'squadron' ? 'SQUADRON / LOGOUT' : 'AIRMAN / LOGOUT');
      roleButton.textContent = label;
      roleButton.setAttribute('aria-label', label);
      roleButton.dataset.owner = 'gate-access-control-controller';
    }
  }

  function setPageActive(page) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
  }

  function patchShowPage() {
    if (showPagePatched) return;
    let original;
    try { original = window.showPage || showPage; } catch (_) { original = window.showPage; }
    if (typeof original !== 'function') return;

    const guarded = function gateAccessShowPage(page, ...rest) {
      const requested = String(page || '').replace(/^page-/, '');
      ensureSquadronPageIfNeeded();

      if (!pageIsAllowed(requested)) {
        toast(role() === 'squadron' ? 'Squadron access is limited to Squadron Board.' : 'Instructor access required for that page.');
        const fallback = firstAllowedPage();
        return original.call(this, fallback, ...rest);
      }

      return original.call(this, requested, ...rest);
    };

    guarded.__gateAccessController = true;
    guarded.__gateOriginal = original;
    window.showPage = guarded;
    try { showPage = guarded; } catch (_) {}
    showPagePatched = true;
  }

  function patchBuildNav() {
    if (buildNavPatched) return;
    let original;
    try { original = window.buildNav || buildNav; } catch (_) { original = window.buildNav; }
    if (typeof original !== 'function') return;

    const patched = function gateAccessBuildNav(...args) {
      try {
        renderAccessAwareNav();
        applyVisibility();
        return undefined;
      } catch (error) {
        console.warn('GATE access nav render failed:', error);
        return original.apply(this, args);
      }
    };

    patched.__gateAccessController = true;
    patched.__gateOriginal = original;
    window.buildNav = patched;
    try { buildNav = patched; } catch (_) {}
    buildNavPatched = true;
  }

  function patchRoleVisibility() {
    if (roleVisibilityPatched) return;
    let original;
    try { original = window.updateRoleVisibility || updateRoleVisibility; } catch (_) { original = window.updateRoleVisibility; }
    if (typeof original !== 'function') return;

    const patched = function gateAccessRoleVisibility(...args) {
      const result = original.apply(this, args);
      applyVisibility();
      return result;
    };

    patched.__gateAccessController = true;
    patched.__gateOriginal = original;
    window.updateRoleVisibility = patched;
    try { updateRoleVisibility = patched; } catch (_) {}
    roleVisibilityPatched = true;
  }

  function guardFunction(name) {
    let fn;
    try { fn = window[name] || eval(name); } catch (_) { fn = window[name]; }
    if (typeof fn !== 'function' || fn.__gateAccessController === true) return;

    const guarded = function gateInstructorOnlyFunction(...args) {
      if (!isInstructor()) {
        const event = args.find(arg => arg && typeof arg.preventDefault === 'function');
        if (event) {
          event.preventDefault();
          event.stopPropagation?.();
          event.stopImmediatePropagation?.();
        }
        toast('Instructor access required for this action.');
        enforceAccess();
        return undefined;
      }
      return fn.apply(this, args);
    };

    guarded.__gateAccessController = true;
    guarded.__gateOriginal = fn;
    window[name] = guarded;
    try { eval(`${name} = window[${JSON.stringify(name)}]`); } catch (_) {}
  }

  function guardedFormSubmit(event) {
    const form = event.target;
    if (!form || !form.id) return;

    if (isInstructor()) return;

    if (AIRMAN_ALLOWED_FORMS.has(form.id) && role() === 'airman') return;

    if (INSTRUCTOR_ONLY_FORMS.has(form.id) || form.closest('#page-airport, #page-input, #page-archives, #dorm-edit-modal, #archive-edit-modal, #airport-bus-edit-modal')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      toast('Instructor access required for this update.');
      enforceAccess();
    }
  }

  function guardedClick(event) {
    if (isInstructor()) return;

    const target = event.target;
    if (!target?.closest) return;

    if (role() === 'squadron') {
      const allowed = target.closest('#page-squadron, #nav-links, #main-nav-menu, #role-toggle, #mobile-menu-trigger, #sound-toggle-btn, #theme-toggle-btn, #fullscreen-btn');
      if (!allowed) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        toast('Squadron access is limited to Squadron Board.');
        enforceAccess();
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
    enforceAccess();
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
    enforceAccess();
  }

  function applyVisibility() {
    setBodyRoleState();

    const instructor = isInstructor();
    const current = role();

    document.querySelectorAll('[data-page]').forEach(el => {
      const page = el.dataset.page;
      el.toggleAttribute('aria-disabled', !pageIsAllowed(page));
    });

    const closeoutBtn = document.getElementById('closeout-btn');
    if (closeoutBtn) closeoutBtn.style.display = instructor ? '' : 'none';

    const processingEditHint = document.getElementById('processing-edit-hint');
    if (processingEditHint) processingEditHint.classList.toggle('hidden', !instructor);

    document.querySelectorAll('#page-airport, #page-input, #page-archives').forEach(page => {
      page.dataset.access = instructor ? 'allowed' : 'instructor-only';
    });

    const localBusButton = Array.from(document.querySelectorAll('button')).find(button => /add local bus/i.test(button.textContent || ''));
    if (localBusButton) {
      localBusButton.style.display = current === 'squadron' ? 'none' : '';
      localBusButton.dataset.access = current === 'airman' || instructor ? 'allowed' : 'restricted';
    }

    document.querySelectorAll('#archive-history [oncontextmenu]').forEach(card => {
      card.style.cursor = instructor ? 'pointer' : 'default';
      card.title = instructor ? 'Right-click to edit archived week group' : 'Archived week group';
      card.dataset.access = instructor ? 'editable' : 'read-only';
    });

    if (current !== 'instructor') closeProtectedSurfaces();
  }

  function enforceAccess() {
    ensureSquadronPageIfNeeded();
    patchShowPage();
    patchBuildNav();
    patchRoleVisibility();
    INSTRUCTOR_ONLY_FUNCTIONS.forEach(guardFunction);
    applyVisibility();

    const active = activePageId();
    if (!active || pageIsAllowed(active)) {
      renderAccessAwareNav();
      return;
    }

    const fallback = firstAllowedPage();
    if (typeof window.showPage === 'function' && window.showPage.__gateAccessController === true) {
      setPageActive(fallback);
      renderAccessAwareNav();
      applyVisibility();
      if (typeof window.runGateHooks === 'function') window.runGateHooks('afterPageChange', { page: fallback, redirectedFrom: active });
      return;
    }

    setPageActive(fallback);
    renderAccessAwareNav();
    applyVisibility();
  }

  function schedulePass() {
    if (passQueued) return;
    passQueued = true;
    window.requestAnimationFrame(() => {
      passQueued = false;
      enforceAccess();
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
      window.addEventListener('resize', schedulePass, true);
      installed = true;
    }

    registerHooksOnce();
    schedulePass();

    window.GateAccessControlController = Object.freeze({
      isCanonicalOwner: true,
      role,
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
