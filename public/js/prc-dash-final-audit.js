// PRC GATE component contract adapter
// Consolidated Status Board / Squadron Board / Header component boundaries.
// Behavior-only pass: no API calls and no save logic changes.
(function () {
  let squadronPageReady = false;
  let navPatched = false;
  let renderAllPatched = false;
  let mobileNavReady = false;
  let brandingObserverReady = false;
  let finalAuditObserverReady = false;
  let passScheduled = false;
  let boardDormSignature = '';
  let squadronDormSignature = '';
  let activeBusSignature = '';

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
    return getRecordsForType('dorm').filter(dorm => dorm.week_group === wg);
  }

  function getBusesForActiveWeek() {
    const wg = getActiveWeekGroupSafe();
    return getRecordsForType('bus').filter(bus => bus.week_group === wg);
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
      dorm.closed_timer
    ].join('|')).join('~');
  }

  function getBusSignature(buses) {
    return buses.map(bus => [
      bus.__backendId,
      bus.bus_id,
      bus.bus_type,
      bus.destination,
      bus.originating_destination,
      bus.status,
      bus.otw_count,
      bus.female_count,
      bus.nat_count,
      bus.space_force_count,
      bus.departed_at,
      bus.created_at
    ].join('|')).join('~');
  }

  function buildGateDormCard(dorm, options = {}) {
    const contract = components();
    if (contract?.dormCard) return contract.dormCard(dorm, options);
    const name = escapeText(dorm?.dorm_name || '');
    const state = escapeText(String(dorm?.state || 'empty').toLowerCase());
    return `<div class="dorm-card tactical-glass-card gate-dorm-card" data-state="${state}"><div class="gate-dorm-name">${name}</div></div>`;
  }

  function renderGateDormColumns(dorms, options) {
    const force = Boolean(options && options.force);
    const records = Array.isArray(dorms) ? dorms : getDormsForActiveWeek();
    const signature = getDormSignature(records);
    if (!force && signature === boardDormSignature) return;
    boardDormSignature = signature;

    ['empty', 'open', 'closed'].forEach(state => {
      const col = document.getElementById('col-' + state);
      if (!col) return;
      const filtered = records.filter(dorm => dorm.state === state);
      col.innerHTML = filtered.map(dorm => buildGateDormCard(dorm, { showAuditorium: true })).join('') || '<div class="text-muted text-xs">None</div>';
    });
  }

  function patchDormRenderers() {
    try {
      window.buildBoardDormCard = buildGateDormCard;
      window.renderDormColumns = function patchedRenderDormColumns(dorms) {
        renderGateDormColumns(dorms, { force: true });
      };
      try { buildBoardDormCard = buildGateDormCard; } catch (_) {}
      try { renderDormColumns = window.renderDormColumns; } catch (_) {}
    } catch (error) {
      console.warn('PRC GATE dorm renderer patch failed:', error);
    }
  }

  function statusMetricMarkup(id, label, value) {
    const contract = components();
    if (contract?.statusMetric) return contract.statusMetric({ id, label, value });
    return `<div class="gate-squadron-metric"><div class="gate-squadron-metric-label">${escapeText(label)}</div><div id="${escapeText(id)}" class="gate-squadron-metric-value">${escapeText(value)}</div></div>`;
  }

  function ensureSquadronPage() {
    if (squadronPageReady && document.getElementById('page-squadron')) return;
    const boardPage = document.getElementById('page-board');
    if (!boardPage) return;

    if (!document.getElementById('page-squadron')) {
      boardPage.insertAdjacentHTML('afterend', `
        <main id="page-squadron" class="page gate-squadron-page" role="main" aria-label="Squadron Board" data-component="squadron-board">
          <div class="gate-squadron-shell">
            <section class="gate-squadron-masthead" aria-label="Squadron Board header">
              <div class="gate-squadron-subtitle">
                <span>Pfingston Reception Center</span>
                <span>Squadron Board</span>
              </div>
            </section>
            <section class="gate-squadron-header" aria-label="Squadron Board metrics" data-component="status-metric-group">
              ${statusMetricMarkup('squadron-metric-arrived', 'Arrived', '0')}
              ${statusMetricMarkup('squadron-metric-expected', 'Expected', '0')}
              ${statusMetricMarkup('squadron-metric-local', 'Local', '--:--')}
            </section>
            <div class="dorm-dashboard" data-component="dorm-column-grid">
              <div class="dorm-column"><div class="dorm-col-header">Empty</div><div id="squadron-col-empty" class="dorm-col-content"></div></div>
              <div class="dorm-column"><div class="dorm-col-header">Open</div><div id="squadron-col-open" class="dorm-col-content"></div></div>
              <div class="dorm-column"><div class="dorm-col-header">Closed</div><div id="squadron-col-closed" class="dorm-col-content"></div></div>
            </div>
          </div>
        </main>
      `);
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
        const patchedBuildNav = function patchedBuildNav() {
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
      console.warn('PRC GATE Squadron Board navigation patch failed:', error);
    }
  }

  function renderSquadronBoard(options) {
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

    const force = Boolean(options && options.force);
    const signature = getDormSignature(dorms);
    if (!force && signature === squadronDormSignature) return;
    squadronDormSignature = signature;

    ['empty', 'open', 'closed'].forEach(state => {
      const col = document.getElementById(`squadron-col-${state}`);
      if (!col) return;
      const filtered = dorms.filter(dorm => dorm.state === state);
      col.innerHTML = filtered.map(dorm => buildGateDormCard(dorm, { hideAirman: true })).join('') || '<div class="text-muted text-xs">None</div>';
    });
  }

  function patchRenderAllForBoards() {
    try {
      if (renderAllPatched || typeof renderAll !== 'function') return;
      const originalRenderAll = renderAll;
      const patchedRenderAll = function patchedRenderAll(...args) {
        const result = originalRenderAll.apply(this, args);
        renderGateDormColumns(null, { force: true });
        renderSquadronBoard({ force: true });
        ensureResponsiveCommandShell();
        scrubLegacyTerminology();
        schedulePass();
        return result;
      };
      window.renderAll = patchedRenderAll;
      try { renderAll = patchedRenderAll; } catch (_) {}
      renderAllPatched = true;
    } catch (error) {
      console.warn('PRC GATE board render patch failed:', error);
    }
  }

  function getBusFromButton(button) {
    try {
      if (typeof allData === 'undefined' || !Array.isArray(allData)) return null;
      const onclick = button.getAttribute('onclick') || '';
      const match = onclick.match(/confirmBusArrival\('([^']+)'\)/);
      const id = match ? match[1] : '';
      if (!id) return null;
      return allData.find(record => record && record.__backendId === id && record.type === 'bus') || null;
    } catch (_) {
      return null;
    }
  }

  function busTitle(bus) {
    if (bus.bus_type === 'local') return `LOCAL – ${String(bus.destination || bus.originating_destination || 'LOCAL').trim()}`;
    return `BUS #${String(bus.bus_id || '').trim()}`;
  }

  function normalizeActiveBusCards(options) {
    const container = document.getElementById('active-buses');
    if (!container) return;
    const buses = getBusesForActiveWeek();
    const signature = getBusSignature(buses);
    if (!options?.force && signature === activeBusSignature) return;
    activeBusSignature = signature;

    container.querySelectorAll('.bus-badge').forEach(button => {
      const bus = getBusFromButton(button);
      if (!bus) return;
      const title = busTitle(bus);
      const otw = n(bus.otw_count);
      const females = n(bus.female_count);
      const nat = n(bus.nat_count);
      const sf = n(bus.space_force_count);
      const departed = formatTime(bus.departed_at || bus.created_at);
      const legacySignature = `${title}|${otw}|${females}|${nat}`;
      const fullSignature = `${legacySignature}|${sf}|${departed}`;
      if (button.dataset.prcFinalBusSig === fullSignature && button.querySelector('.prc-bus-card-dept')) return;
      button.classList.add('prc-bus-card');
      button.dataset.component = 'active-bus-card';
      button.dataset.prcBusCardSig = legacySignature;
      button.dataset.prcFinalBusSig = fullSignature;
      button.title = `Confirm arrival: ${title} – ${otw} OTW | ${females} FEMALE | ${nat} NAT | ${sf} SPACE FORCE | DEPT ${departed}`;
      button.setAttribute('aria-label', button.title);
      button.innerHTML = `
        <span class="prc-bus-card-title">${escapeText(title)}</span>
        <span class="prc-bus-card-line">${otw} OTW</span>
        <span class="prc-bus-card-line">${females} FEMALE</span>
        <span class="prc-bus-card-line">${nat} NAT</span>
        <span class="prc-bus-card-line">${sf} SPACE FORCE</span>
        <span class="prc-bus-card-dept">DEPT: ${escapeText(departed)}</span>
      `;
    });
  }

  function keepNavigationRecoverable() {
    if (!document.fullscreenElement && document.body.classList.contains('fullscreen-board')) {
      document.body.classList.remove('fullscreen-board');
      const btn = document.getElementById('fullscreen-btn');
      if (btn) btn.textContent = 'FULL SCREEN';
    }
  }

  function runPass() {
    passScheduled = false;
    ensureDocumentIdentity();
    ensureSquadronPage();
    patchNavigationForSquadronBoard();
    patchDormRenderers();
    patchRenderAllForBoards();
    ensureResponsiveCommandShell();
    components()?.processingDormModalContract?.();
    ensureBrandingObserver();
    try { keepNavigationRecoverable(); } catch (error) { console.warn('PRC GATE nav recovery failed:', error); }
    try { renderGateDormColumns(); } catch (error) { console.warn('PRC GATE Status Board render failed:', error); }
    try { renderSquadronBoard(); } catch (error) { console.warn('PRC GATE Squadron Board render failed:', error); }
    try { normalizeActiveBusCards(); } catch (error) { console.warn('PRC GATE active bus render failed:', error); }
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    window.requestAnimationFrame(runPass);
  }

  function observeUiTargets() {
    if (finalAuditObserverReady || typeof MutationObserver === 'undefined' || !document.body) return;
    const observer = new MutationObserver(mutations => {
      const shouldSchedule = mutations.some(mutation => {
        if (mutation.type === 'childList') return true;
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (!target?.closest) return target === document.body;
          return Boolean(target.closest('.page, .app-nav, #active-buses, .dorm-col-content, #dorm-modal'));
        }
        return false;
      });
      if (shouldSchedule) schedulePass();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'onclick', 'data-component']
    });
    finalAuditObserverReady = true;
  }

  function bindEvents() {
    document.addEventListener('click', schedulePass, true);
    document.addEventListener('change', schedulePass, true);
    document.addEventListener('input', event => {
      const target = event.target;
      if (target?.matches?.('input, select, textarea')) schedulePass();
    }, true);
    document.addEventListener('fullscreenchange', schedulePass, true);
    document.addEventListener('visibilitychange', schedulePass, true);
    window.addEventListener('resize', schedulePass, true);
  }

  function start() {
    observeUiTargets();
    bindEvents();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
