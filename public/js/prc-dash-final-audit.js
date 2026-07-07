// GATE Dorm Board Controller
// Canonical owner for Status Board dorm cards, Squadron Board runtime shell, board metrics, and close-dorm final-time safety.
(function () {
  'use strict';

  let squadronPageReady = false;
  let navPatched = false;
  let renderLifecyclePatched = false;
  let closeDormPatched = false;
  let mobileNavReady = false;
  let brandingObserverReady = false;
  let boardObserverReady = false;
  let eventsBound = false;
  let passScheduled = false;
  let boardDormSignature = '';
  let squadronDormSignature = '';

  function components() {
    return window.GateComponents || null;
  }

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function escapeText(value) {
    if (components()?.esc) return components().esc(value);
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function ensureDocumentIdentity() {
    document.title = 'GATE — Gateway Arrival Tracking Environment | Pfingston Reception Center';
    document.documentElement.setAttribute('lang', 'en');
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
    if (!document.querySelector('meta[name="description"]')) {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'U.S. Air Force Basic Military Training — Arrival Tracking Command Shell';
      document.head.appendChild(meta);
    }
  }

  function getActiveWeekGroupSafe() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function getRecordsForType(type) {
    try { return typeof getRecords === 'function' ? getRecords(type) : []; } catch (_) { return []; }
  }

  function getDormsForActiveWeek() {
    const wg = getActiveWeekGroupSafe();
    return getRecordsForType('dorm').filter(dorm => !wg || dorm.week_group === wg);
  }

  function getBusesForActiveWeek() {
    const wg = getActiveWeekGroupSafe();
    return getRecordsForType('bus').filter(bus => !wg || bus.week_group === wg);
  }

  function getDormSignature(dorms) {
    return dorms.map(dorm => [
      dorm.__backendId,
      dorm.dorm_name,
      dorm.assigned_airman,
      dorm.auditorium_location,
      dorm.sdq,
      dorm.section,
      dorm.inter_sec,
      dorm.sex,
      dorm.band,
      dorm.space_force,
      dorm.is_space_force,
      dorm.state,
      dorm.phase,
      dorm.current_load,
      dorm.max_load,
      dorm.opened_at,
      dorm.closed_at,
      dorm.closed_timer,
      dorm.notes
    ].join('|')).join('~');
  }

  function getSquadronSignature(dorms, buses) {
    const dormPart = getDormSignature(dorms);
    const busPart = buses.map(bus => [
      bus.__backendId,
      bus.status,
      bus.otw_count,
      bus.female_count,
      bus.nat_count,
      bus.space_force_count,
      bus.created_at,
      bus.arrived_at
    ].join('|')).join('~');
    return `${dormPart}::${busPart}`;
  }

  function buildGateDormCard(dorm, options = {}) {
    const contract = components();
    if (contract?.dormCard) return contract.dormCard(dorm, options);
    const name = escapeText(dorm?.dorm_name || '');
    const state = escapeText(String(dorm?.state || 'empty').toLowerCase());
    return `<div class="dorm-card tactical-glass-card gate-dorm-card" data-component="dorm-card" data-state="${state}"><div class="gate-dorm-name">${name}</div></div>`;
  }

  function renderDormColumnSet({ prefix = 'col', dorms = [], hideAirman = false, showAuditorium = false } = {}) {
    ['empty', 'open', 'closed'].forEach(state => {
      const col = document.getElementById(`${prefix}-${state}`);
      if (!col) return;

      col.dataset.component = 'dorm-column';
      col.dataset.owner = 'gate-dorm-board-controller';
      col.dataset.state = state;

      const filtered = dorms.filter(dorm => String(dorm.state || 'empty').toLowerCase() === state);
      col.innerHTML = filtered
        .map(dorm => buildGateDormCard(dorm, { hideAirman, showAuditorium }))
        .join('') || '<div class="text-muted text-xs" data-owner="gate-dorm-board-controller" data-empty-state="true">None</div>';
    });
  }

  function renderGateDormColumns(dorms, options = {}) {
    const force = Boolean(options.force);
    const records = Array.isArray(dorms) ? dorms : getDormsForActiveWeek();
    const signature = getDormSignature(records);
    if (!force && signature === boardDormSignature) return;
    boardDormSignature = signature;

    const boardPage = document.getElementById('page-board');
    if (boardPage) {
      boardPage.dataset.component = 'status-board';
      boardPage.dataset.owner = 'gate-dorm-board-controller';
    }

    renderDormColumnSet({ prefix: 'col', dorms: records, showAuditorium: true });
  }

  function patchDormRenderers() {
    try {
      window.buildBoardDormCard = buildGateDormCard;
      window.renderDormColumns = function gateRenderDormColumns(dorms) {
        renderGateDormColumns(dorms, { force: true });
      };
      try { buildBoardDormCard = buildGateDormCard; } catch (_) {}
      try { renderDormColumns = window.renderDormColumns; } catch (_) {}
    } catch (error) {
      console.warn('GATE dorm renderer patch failed:', error);
    }
  }

  function statusMetricMarkup(id, label, value) {
    const contract = components();
    if (contract?.statusMetric) return contract.statusMetric({ id, label, value });
    return `<div class="gate-squadron-metric" data-component="status-metric"><div class="gate-squadron-metric-label">${escapeText(label)}</div><div id="${escapeText(id)}" class="gate-squadron-metric-value">${escapeText(value)}</div></div>`;
  }

  function ensureSquadronPage() {
    const boardPage = document.getElementById('page-board');
    if (!boardPage) return;

    let page = document.getElementById('page-squadron');
    if (!page) {
      boardPage.insertAdjacentHTML('afterend', `
        <main id="page-squadron" class="page gate-squadron-page" role="main" aria-label="Squadron Board" data-component="squadron-board" data-owner="gate-dorm-board-controller">
          <div class="gate-squadron-shell">
            <section class="gate-squadron-masthead" aria-label="Squadron Board header">
              <div class="gate-squadron-subtitle">
                <span>Pfingston Reception Center</span>
                <span>Squadron Board</span>
              </div>
            </section>
            <section class="gate-squadron-header" aria-label="Squadron Board metrics" data-component="status-metric-group" data-owner="gate-dorm-board-controller">
              ${statusMetricMarkup('squadron-metric-arrived', 'Arrived', '0')}
              ${statusMetricMarkup('squadron-metric-expected', 'Expected', '0')}
              ${statusMetricMarkup('squadron-metric-local', 'Local', '--:--')}
            </section>
            <div class="dorm-dashboard" data-component="dorm-column-grid" data-owner="gate-dorm-board-controller">
              <div class="dorm-column"><div class="dorm-col-header">Empty</div><div id="squadron-col-empty" class="dorm-col-content"></div></div>
              <div class="dorm-column"><div class="dorm-col-header">Open</div><div id="squadron-col-open" class="dorm-col-content"></div></div>
              <div class="dorm-column"><div class="dorm-col-header">Closed</div><div id="squadron-col-closed" class="dorm-col-content"></div></div>
            </div>
          </div>
        </main>
      `);
      page = document.getElementById('page-squadron');
    }

    if (page) {
      page.dataset.component = 'squadron-board';
      page.dataset.owner = 'gate-dorm-board-controller';
    }

    squadronPageReady = true;
  }

  function ensureResponsiveCommandShell() {
    const nav = document.querySelector('.app-nav');
    const menu = document.getElementById('main-nav-menu') || document.getElementById('nav-links');
    if (!nav || !menu) return;

    nav.classList.add('command-header-bar');
    nav.dataset.component = 'header-nav';
    nav.setAttribute('role', 'banner');
    menu.id = 'main-nav-menu';
    menu.classList.add('nav-group-left');
    menu.dataset.component = 'header-nav-menu';
    menu.setAttribute('role', 'navigation');
    menu.setAttribute('aria-label', 'Main Operational Navigation');

    const rightGroup = nav.querySelector(':scope > div:last-child');
    if (rightGroup) {
      rightGroup.classList.add('nav-group-right');
      rightGroup.dataset.component = 'header-system-controls';
      rightGroup.setAttribute('role', 'complementary');
      rightGroup.setAttribute('aria-label', 'System Identity Control');
    }

    if (!document.getElementById('mobile-menu-trigger')) {
      const trigger = document.createElement('button');
      trigger.id = 'mobile-menu-trigger';
      trigger.type = 'button';
      trigger.className = 'tactical-nav-pill mobile-only-control gate-component-nav-button';
      trigger.dataset.component = 'mobile-nav-trigger';
      trigger.setAttribute('aria-label', 'Toggle Operational Navigation Menu');
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', 'main-nav-menu');
      trigger.innerHTML = '<span>Menu</span><span class="menu-arrow-indicator" aria-hidden="true">▾</span>';
      nav.insertBefore(trigger, menu);
    }

    const trigger = document.getElementById('mobile-menu-trigger');
    if (!trigger || mobileNavReady) return;

    let isOpen = false;
    const setMenuState = state => {
      isOpen = Boolean(state);
      trigger.setAttribute('aria-expanded', String(isOpen));
      menu.classList.toggle('mobile-dropdown-active', isOpen);
    };

    trigger.addEventListener('click', event => {
      event.stopPropagation();
      setMenuState(!isOpen);
    });

    menu.addEventListener('click', event => {
      if (event.target.closest('button, a')) window.setTimeout(() => setMenuState(false), 80);
    });

    document.addEventListener('click', event => {
      if (isOpen && !menu.contains(event.target) && !trigger.contains(event.target)) setMenuState(false);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && isOpen) {
        setMenuState(false);
        trigger.focus({ preventScroll: true });
      }
    });

    mobileNavReady = true;
  }

  function scrubLegacyTerminology() {
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return /prc\s?dash|dashboard/i.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });

    let node;
    while ((node = walker.nextNode())) {
      node.nodeValue = node.nodeValue
        .replace(/PRC\s?DASH/gi, 'PRC GATE')
        .replace(/dashboard/gi, 'board');
    }
  }

  function ensureBrandingObserver() {
    if (brandingObserverReady || typeof MutationObserver === 'undefined' || !document.body) return;
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        scrubLegacyTerminology();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    brandingObserverReady = true;
  }

  function navButtonMarkup(page, label, active) {
    const contract = components();
    if (contract?.navButton) return contract.navButton({ page, label, active });
    const activeClass = active ? 'active active-page-state current-page' : '';
    return `<button type="button" class="nav-btn nav-link-item ${activeClass}" data-page="${escapeText(page)}" onclick="showPage('${escapeText(page)}')">${escapeText(label || page)}</button>`;
  }

  function patchNavigationForSquadronBoard() {
    try {
      if (typeof PAGE_LABELS !== 'undefined') PAGE_LABELS.squadron = 'Squadron Board';
      if (typeof PAGES_INSTRUCTOR !== 'undefined' && Array.isArray(PAGES_INSTRUCTOR) && !PAGES_INSTRUCTOR.includes('squadron')) {
        PAGES_INSTRUCTOR.push('squadron');
      }

      if (!navPatched && typeof buildNav === 'function') {
        const patchedBuildNav = function gateBuildNav() {
          const pages = currentRole === 'squadron'
            ? ['squadron']
            : (currentRole === 'instructor' ? PAGES_INSTRUCTOR : PAGES_AIRMAN);
          const container = document.getElementById('main-nav-menu') || document.getElementById('nav-links');
          const activePage = document.querySelector('.page.active');
          const activeId = activePage ? activePage.id.replace('page-', '') : (currentRole === 'squadron' ? 'squadron' : 'board');

          if (container) {
            container.innerHTML = pages.map(page => navButtonMarkup(page, PAGE_LABELS[page] || page, page === activeId)).join('');
          }

          const roleButton = document.getElementById('role-toggle');
          if (roleButton) {
            roleButton.textContent = currentRole === 'instructor'
              ? 'INSTRUCTOR / LOGOUT'
              : (currentRole === 'squadron' ? 'SQUADRON / LOGOUT' : 'AIRMAN / LOGOUT');
            roleButton.setAttribute('aria-label', roleButton.textContent);
          }

          ensureResponsiveCommandShell();
          if (typeof updateRoleVisibility === 'function') updateRoleVisibility();
        };
        window.buildNav = patchedBuildNav;
        try { buildNav = patchedBuildNav; } catch (_) {}
        navPatched = true;
      }
    } catch (error) {
      console.warn('GATE Squadron Board navigation patch failed:', error);
    }
  }

  function renderSquadronBoard(options = {}) {
    ensureSquadronPage();
    if (!document.getElementById('page-squadron')) return;

    const dorms = getDormsForActiveWeek();
    const buses = getBusesForActiveWeek();
    const expected = dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    const arrived = buses.filter(bus => bus.status === 'arrived').reduce((sum, bus) => sum + n(bus.otw_count), 0);

    const arrivedEl = document.getElementById('squadron-metric-arrived');
    const expectedEl = document.getElementById('squadron-metric-expected');
    const localEl = document.getElementById('squadron-metric-local');
    if (arrivedEl) arrivedEl.textContent = String(arrived);
    if (expectedEl) expectedEl.textContent = String(expected);
    if (localEl) localEl.textContent = typeof getLocalTime24 === 'function' ? getLocalTime24() : formatTime(new Date().toISOString());

    const force = Boolean(options.force);
    const signature = getSquadronSignature(dorms, buses);
    if (!force && signature === squadronDormSignature) return;
    squadronDormSignature = signature;

    renderDormColumnSet({ prefix: 'squadron-col', dorms, hideAirman: true });
  }

  function computeDormElapsedTimer(dorm) {
    if (!dorm || !dorm.opened_at) return dorm?.closed_timer || '00:00';
    if (typeof getElapsedTimer === 'function') {
      try {
        const timer = getElapsedTimer(dorm.opened_at);
        if (timer?.text) return timer.text;
      } catch (_) {}
    }

    const opened = new Date(dorm.opened_at);
    if (Number.isNaN(opened.getTime())) return dorm.closed_timer || '00:00';
    const diff = Math.max(0, Date.now() - opened.getTime());
    const totalSeconds = Math.floor(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function patchCloseDormTiming() {
    try {
      if (closeDormPatched || typeof closeDorm !== 'function') return;

      const gateCloseDorm = async function gateCloseDorm(id) {
        if (typeof currentRole !== 'undefined' && currentRole !== 'instructor') return;
        const dorm = Array.isArray(allData) ? allData.find(record => record.__backendId === id) : null;
        if (!dorm) return;

        const finalTime = computeDormElapsedTimer(dorm);
        const result = await window.dataSdk.update({
          ...dorm,
          state: 'closed',
          phase: 'Closed',
          closed_timer: finalTime,
          closed_at: new Date().toISOString()
        });

        if (result && result.isOk) {
          if (typeof createSoundEvent === 'function') {
            await createSoundEvent('dorm_closed', {
              dorm_id: id,
              dorm_name: dorm.dorm_name || '',
              final_time: finalTime,
              action: 'close_dorm'
            });
          }
        }

        if (typeof closeDormModal === 'function') closeDormModal();
      };

      gateCloseDorm.__gateDormBoardController = true;
      window.closeDorm = gateCloseDorm;
      try { closeDorm = gateCloseDorm; } catch (_) {}
      closeDormPatched = true;
    } catch (error) {
      console.warn('GATE close dorm timing patch failed:', error);
    }
  }

  function patchRenderLifecycle() {
    try {
      if (renderLifecyclePatched) return;

      if (typeof window.registerGateHook === 'function') {
        window.registerGateHook('afterRenderAll', () => schedulePass({ force: true }));
        window.registerGateHook('afterDataChanged', () => schedulePass({ force: true }));
        window.registerGateHook('afterPageChange', () => schedulePass());
        renderLifecyclePatched = true;
        return;
      }

      if (typeof renderAll !== 'function') return;
      const originalRenderAll = renderAll;
      const patchedRenderAll = function gateDormBoardRenderAll(...args) {
        const result = originalRenderAll.apply(this, args);
        schedulePass({ force: true });
        return result;
      };
      window.renderAll = patchedRenderAll;
      try { renderAll = patchedRenderAll; } catch (_) {}
      renderLifecyclePatched = true;
    } catch (error) {
      console.warn('GATE board lifecycle patch failed:', error);
    }
  }

  function keepNavigationRecoverable() {
    if (!document.fullscreenElement && document.body.classList.contains('fullscreen-board')) {
      document.body.classList.remove('fullscreen-board');
      const btn = document.getElementById('fullscreen-btn');
      if (btn) btn.textContent = 'FULL SCREEN';
    }
  }

  function runPass(options = {}) {
    passScheduled = false;
    ensureDocumentIdentity();
    ensureSquadronPage();
    patchNavigationForSquadronBoard();
    patchDormRenderers();
    patchCloseDormTiming();
    patchRenderLifecycle();
    ensureResponsiveCommandShell();
    components()?.processingDormModalContract?.();
    ensureBrandingObserver();
    try { keepNavigationRecoverable(); } catch (error) { console.warn('GATE nav recovery failed:', error); }
    try { renderGateDormColumns(null, { force: Boolean(options.force) }); } catch (error) { console.warn('GATE Status Board render failed:', error); }
    try { renderSquadronBoard({ force: Boolean(options.force) }); } catch (error) { console.warn('GATE Squadron Board render failed:', error); }
    if (typeof window.GateActiveBusController?.render === 'function') {
      try { window.GateActiveBusController.render({ force: Boolean(options.force) }); } catch (error) { console.warn('GATE active bus render handoff failed:', error); }
    }
  }

  function schedulePass(options = {}) {
    if (passScheduled) return;
    passScheduled = true;
    window.requestAnimationFrame(() => runPass(options));
  }

  function observeUiTargets() {
    if (boardObserverReady || typeof MutationObserver === 'undefined' || !document.body) return;
    const observer = new MutationObserver(mutations => {
      const shouldSchedule = mutations.some(mutation => {
        if (mutation.type === 'childList') return true;
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (!target?.closest) return target === document.body;
          return Boolean(target.closest('.page, .app-nav, .dorm-col-content, #dorm-modal, #page-squadron'));
        }
        return false;
      });
      if (shouldSchedule) schedulePass();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'onclick', 'data-component', 'data-owner', 'data-state']
    });
    boardObserverReady = true;
  }

  function bindEvents() {
    if (eventsBound) return;
    document.addEventListener('click', () => schedulePass(), true);
    document.addEventListener('change', () => schedulePass(), true);
    document.addEventListener('input', event => {
      const target = event.target;
      if (target?.matches?.('input, select, textarea')) schedulePass();
    }, true);
    document.addEventListener('fullscreenchange', () => schedulePass({ force: true }), true);
    document.addEventListener('visibilitychange', () => schedulePass(), true);
    window.addEventListener('resize', () => schedulePass(), true);
    eventsBound = true;
  }

  function exposeController() {
    if (window.GateDormBoardController?.isCanonicalOwner === true) return;
    window.GateDormBoardController = Object.freeze({
      isCanonicalOwner: true,
      renderStatusBoard: function renderStatusBoard() { renderGateDormColumns(null, { force: true }); },
      renderSquadronBoard: function renderSquadronBoardPublic() { renderSquadronBoard({ force: true }); },
      ensureSquadronPage,
      patchCloseDormTiming,
      computeDormElapsedTimer,
      refresh: function refresh() { schedulePass({ force: true }); }
    });
  }

  function start() {
    exposeController();
    observeUiTargets();
    bindEvents();
    schedulePass({ force: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
