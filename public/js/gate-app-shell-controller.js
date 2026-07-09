// GATE Phase 1A App Shell Controller
// Canonical owner for route switching, role-aware nav rendering, page isolation, and mobile drawer behavior.
(function () {
  'use strict';

  const ROLE_PAGES = Object.freeze({
    instructor: ['board', 'airport', 'input', 'processing', 'archives', 'squadron'],
    airman: ['board', 'processing'],
    squadron: ['squadron']
  });

  const PAGE_LABELS_CANONICAL = Object.freeze({
    board: 'Status Board',
    airport: 'Airport',
    input: 'Input',
    processing: 'Processing',
    archives: 'Archives',
    squadron: 'Squadron Board'
  });

  const MOBILE_MEDIA = '(max-width: 767px), (pointer: coarse) and (max-width: 1024px) and (max-height: 560px)';
  const SYSTEM_CONTROL_IDS = ['role-toggle', 'fullscreen-btn', 'sound-toggle-btn', 'theme-toggle-btn'];

  let installed = false;
  let drawerOpen = false;
  let systemAnchor = null;
  let scheduled = false;

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function role() {
    try { return currentRole || 'airman'; } catch (_) { return 'airman'; }
  }

  function allowedPages(current = role()) {
    return ROLE_PAGES[current] || ROLE_PAGES.airman;
  }

  function pageIsAllowed(page, current = role()) {
    return allowedPages(current).includes(page);
  }

  function firstAllowedPage(current = role()) {
    return allowedPages(current)[0] || 'board';
  }

  function isMobileShell() {
    return window.matchMedia(MOBILE_MEDIA).matches;
  }

  function pageLabel(page) {
    try {
      if (typeof PAGE_LABELS !== 'undefined' && PAGE_LABELS[page]) return PAGE_LABELS[page];
    } catch (_) {}
    return PAGE_LABELS_CANONICAL[page] || page;
  }

  function navElement() {
    return document.querySelector('.app-nav, .command-header-bar');
  }

  function menuElement() {
    return document.getElementById('main-nav-menu') || document.getElementById('nav-links') || document.querySelector('.nav-group-left');
  }

  function rightGroup() {
    const nav = navElement();
    if (!nav) return null;
    return nav.querySelector('.nav-group-right') || nav.querySelector(':scope > div:last-child') || null;
  }

  function activePage() {
    const page = document.querySelector('.page.active');
    return page ? page.id.replace(/^page-/, '') : firstAllowedPage();
  }

  function toast(message) {
    let el = document.getElementById('gate-shell-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gate-shell-toast';
      el.className = 'gate-shell-toast hidden';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(el.__gateHideTimer);
    el.__gateHideTimer = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  function ensureSquadronPage() {
    if (document.getElementById('page-squadron')) return true;
    try {
      window.GateDormBoardController?.refresh?.();
    } catch (_) {}
    try {
      if (!document.getElementById('page-squadron') && typeof renderAll === 'function') renderAll();
    } catch (_) {}
    return Boolean(document.getElementById('page-squadron'));
  }

  function ensureShellStructure() {
    const nav = navElement();
    const menu = menuElement();
    if (!nav || !menu) return;

    document.body.classList.add('gate-app-shell-ready');
    nav.classList.add('command-header-bar');
    nav.dataset.owner = 'gate-app-shell-controller';
    nav.dataset.component = 'app-shell';
    nav.setAttribute('role', 'banner');

    menu.id = 'main-nav-menu';
    menu.classList.add('nav-group-left');
    menu.dataset.owner = 'gate-app-shell-controller';
    menu.dataset.component = 'app-shell-nav-menu';
    menu.setAttribute('role', 'navigation');
    menu.setAttribute('aria-label', 'Operational navigation');

    const right = rightGroup();
    if (right) {
      right.classList.add('nav-group-right');
      right.dataset.component = 'app-shell-system-controls';
      right.dataset.owner = 'gate-app-shell-controller';
      right.setAttribute('aria-label', 'System controls');
    }

    const theme = document.querySelector('button[aria-label="Toggle theme"], button[aria-label*="theme" i]');
    if (theme && !theme.id) theme.id = 'theme-toggle-btn';

    if (!document.getElementById('mobile-menu-trigger')) {
      const trigger = document.createElement('button');
      trigger.id = 'mobile-menu-trigger';
      trigger.type = 'button';
      trigger.className = 'nav-btn mobile-only-control gate-component-nav-button';
      trigger.dataset.component = 'mobile-nav-trigger';
      trigger.dataset.owner = 'gate-app-shell-controller';
      trigger.setAttribute('aria-label', 'Toggle Operational Navigation Menu');
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', 'main-nav-menu');
      trigger.innerHTML = '<span>Menu</span><span class="menu-arrow-indicator" aria-hidden="true">▾</span>';
      nav.insertBefore(trigger, menu);
    }
  }

  function ensureSystemAnchor() {
    const right = rightGroup();
    if (!right) return null;
    if (systemAnchor && systemAnchor.isConnected) return systemAnchor;
    systemAnchor = document.createComment('gate-app-shell-system-controls-anchor');
    right.appendChild(systemAnchor);
    return systemAnchor;
  }

  function ensureSystemPanel() {
    const menu = menuElement();
    if (!menu) return null;
    let panel = document.getElementById('gate-shell-system-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'gate-shell-system-panel';
      panel.className = 'gate-shell-system-panel';
      panel.dataset.owner = 'gate-app-shell-controller';
      panel.setAttribute('aria-label', 'System controls');
      panel.innerHTML = '<div class="gate-shell-system-label">System</div><div id="gate-shell-system-controls" class="gate-shell-system-controls"></div>';
    }
    if (!menu.contains(panel)) menu.appendChild(panel);
    return panel.querySelector('#gate-shell-system-controls');
  }

  function systemControls() {
    const controls = [];
    SYSTEM_CONTROL_IDS.forEach(id => {
      const element = document.getElementById(id);
      if (element && !controls.includes(element)) controls.push(element);
    });
    return controls;
  }

  function moveSystemControlsForViewport() {
    ensureSystemAnchor();
    const mobile = isMobileShell();
    document.body.classList.toggle('gate-app-shell-mobile', mobile);
    document.body.classList.toggle('gate-app-shell-desktop', !mobile);

    if (mobile) {
      const target = ensureSystemPanel();
      if (!target) return;
      systemControls().forEach(control => {
        control.type = 'button';
        control.dataset.gateShellSystemControl = 'true';
        target.appendChild(control);
      });
      return;
    }

    const right = rightGroup();
    const anchor = ensureSystemAnchor();
    if (!right) return;
    systemControls().forEach(control => {
      control.dataset.gateShellSystemControl = 'false';
      if (anchor && anchor.parentNode === right) right.insertBefore(control, anchor);
      else right.appendChild(control);
    });
    setDrawer(false);
  }

  function renderWeekGroup() {
    const el = document.getElementById('week-group-display');
    if (!el) return;
    let wg = '';
    try { wg = typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { wg = ''; }
    const text = wg || 'No WG';
    el.textContent = isMobileShell() && wg ? `WG ${String(wg).replace(/^WG\s*/i, '')}` : text;
    el.title = text;
    el.setAttribute('aria-label', `Active week group: ${text}`);
    el.dataset.owner = 'gate-app-shell-controller';
  }

  function navButton(page) {
    const active = page === activePage();
    return `<button type="button" class="nav-btn nav-link-item gate-component-nav-button ${active ? 'active active-page-state current-page' : ''}" data-page="${esc(page)}" data-gate-nav-button="true" aria-current="${active ? 'page' : 'false'}">${esc(pageLabel(page))}</button>`;
  }

  function renderNav() {
    ensureShellStructure();
    const menu = menuElement();
    if (!menu) return;

    if (allowedPages().includes('squadron')) ensureSquadronPage();

    const pages = allowedPages();
    menu.querySelectorAll('[data-gate-nav-button="true"]').forEach(button => button.remove());
    const panel = document.getElementById('gate-shell-system-panel');
    const html = pages.map(navButton).join('');
    if (panel && panel.parentNode === menu) {
      panel.insertAdjacentHTML('beforebegin', html);
    } else {
      menu.innerHTML = html;
    }

    menu.dataset.role = role();
    menu.dataset.owner = 'gate-app-shell-controller';

    const roleButton = document.getElementById('role-toggle');
    if (roleButton) {
      const label = role() === 'instructor' ? 'INSTRUCTOR / LOGOUT' : (role() === 'squadron' ? 'SQUADRON / LOGOUT' : 'AIRMAN / LOGOUT');
      roleButton.textContent = label;
      roleButton.setAttribute('aria-label', label);
    }

    renderWeekGroup();
    moveSystemControlsForViewport();
  }

  function setActivePage(page) {
    document.querySelectorAll('.page').forEach(element => {
      const isActive = element.id === `page-${page}`;
      element.classList.toggle('active', isActive);
      element.classList.toggle('gate-shell-active-page', isActive);
      element.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      element.dataset.gateRouteState = isActive ? 'active' : 'inactive';
    });
  }

  function go(page, options = {}) {
    ensureShellStructure();
    const requested = String(page || '').replace(/^page-/, '') || firstAllowedPage();
    if (requested === 'squadron') ensureSquadronPage();

    let targetPage = requested;
    if (!pageIsAllowed(targetPage)) {
      toast(role() === 'squadron' ? 'Squadron access is limited to Squadron Board.' : 'Instructor access required for that page.');
      targetPage = firstAllowedPage();
      if (targetPage === 'squadron') ensureSquadronPage();
    }

    if (!document.getElementById(`page-${targetPage}`)) {
      const fallback = allowedPages().find(candidate => document.getElementById(`page-${candidate}`)) || 'board';
      targetPage = fallback;
    }

    setActivePage(targetPage);
    renderNav();
    setDrawer(false);

    try { if (typeof updateRoleVisibility === 'function') updateRoleVisibility(); } catch (_) {}
    try { window.GatePermissionGuard?.enforce?.(); } catch (_) {}
    if (!options.silent) {
      try { window.runGateHooks?.('afterPageChange', { page: targetPage, source: 'gate-app-shell-controller' }); } catch (_) {}
    }
    return targetPage;
  }

  function patchGlobals() {
    const gateShowPage = function gateAppShellShowPage(page) {
      return go(page);
    };
    gateShowPage.__gateAppShellController = true;
    window.showPage = gateShowPage;
    try { showPage = gateShowPage; } catch (_) {}

    const gateBuildNav = function gateAppShellBuildNav() {
      renderNav();
    };
    gateBuildNav.__gateAppShellController = true;
    window.buildNav = gateBuildNav;
    try { buildNav = gateBuildNav; } catch (_) {}
  }

  function setDrawer(open) {
    drawerOpen = Boolean(open) && isMobileShell();
    const menu = menuElement();
    const trigger = document.getElementById('mobile-menu-trigger');
    document.body.classList.toggle('gate-mobile-drawer-open', drawerOpen);
    if (menu) {
      menu.classList.toggle('mobile-dropdown-active', drawerOpen);
      menu.setAttribute('aria-hidden', drawerOpen ? 'false' : 'true');
    }
    if (trigger) trigger.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
  }

  function routeFromEvent(event) {
    const button = event.target?.closest?.('[data-gate-nav-button="true"], [data-page].nav-btn');
    if (!button) return false;
    const menu = menuElement();
    if (!menu || !menu.contains(button)) return false;
    const page = button.dataset.page;
    if (!page) return false;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    go(page);
    return true;
  }

  function handleClick(event) {
    const trigger = event.target?.closest?.('#mobile-menu-trigger');
    if (trigger) {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
      setDrawer(!drawerOpen);
      return;
    }

    if (routeFromEvent(event)) return;

    const menu = menuElement();
    if (drawerOpen && menu && !menu.contains(event.target)) setDrawer(false);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') setDrawer(false);
  }

  function sync() {
    scheduled = false;
    ensureShellStructure();
    patchGlobals();
    renderNav();
    const current = activePage();
    if (!pageIsAllowed(current)) go(firstAllowedPage(), { silent: true });
    else setActivePage(current);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  function start() {
    if (installed) return;
    installed = true;
    ensureShellStructure();
    patchGlobals();
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('resize', scheduleSync, true);
    window.addEventListener('orientationchange', scheduleSync, true);
    window.registerGateHook?.('afterRenderAll', scheduleSync);
    window.registerGateHook?.('afterDataChanged', scheduleSync);
    window.registerGateHook?.('afterPageChange', scheduleSync);
    window.GateAppShell = Object.freeze({
      isCanonicalOwner: true,
      go,
      renderNav,
      allowedPages,
      pageIsAllowed,
      currentPage: activePage,
      setDrawer,
      sync: scheduleSync
    });
    scheduleSync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
