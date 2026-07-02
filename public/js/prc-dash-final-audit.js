// PRC GATE final UI/functionality safety patch
// Consolidated Status Board / Squadron Board display helpers.
// Behavior-only pass: no recurring visual polling.
(function () {
  let stylesReady = false;
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

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function escapeText(value) {
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

  function ensureStyles() {
    if (stylesReady || document.getElementById('prc-gate-board-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-gate-board-styles';
    style.textContent = `
      .app-nav { display: flex; }
      .fullscreen-board .app-nav { display: none !important; }

      #page-squadron.gate-squadron-page {
        padding: 76px 0.85rem 0.85rem !important;
        min-height: 100vh;
        overflow: hidden;
      }

      #page-squadron .gate-squadron-shell {
        min-height: calc(100vh - 84px);
        display: flex;
        flex-direction: column;
        gap: 0.78rem;
        position: relative;
      }

      #page-squadron .gate-squadron-masthead {
        position: relative;
        overflow: visible;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: min(920px, calc(100vw - 2rem));
        min-height: 74px;
        margin: 0 auto;
        padding: 1.18rem 1.35rem 1.08rem;
        border: 1px solid rgba(125, 211, 252, 0.18);
        border-radius: 1.15rem;
        background:
          radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.13), transparent 46%),
          linear-gradient(145deg, rgba(255, 255, 255, 0.088), rgba(255, 255, 255, 0.028));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.13),
          0 10px 26px rgba(0, 0, 0, 0.20),
          0 0 24px rgba(56, 189, 248, 0.06);
        -webkit-backdrop-filter: blur(18px) saturate(1.12);
        backdrop-filter: blur(18px) saturate(1.12);
      }

      #page-squadron .gate-squadron-masthead::after {
        content: '';
        position: absolute;
        left: 12%;
        right: 12%;
        bottom: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(125, 211, 252, 0.58), rgba(34, 197, 94, 0.20), transparent);
        box-shadow: 0 0 14px rgba(56, 189, 248, 0.24);
      }

      #page-squadron .gate-squadron-subtitle {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0.72rem;
        color: var(--text-soft);
        font-size: clamp(1.02rem, 1.82vw, 1.48rem);
        font-weight: 950;
        letter-spacing: 0.18em;
        line-height: 1.24;
        text-transform: uppercase;
        text-align: center;
        padding: 0.06rem 0 0.04rem;
      }

      #page-squadron .gate-squadron-subtitle span {
        display: inline-flex;
        align-items: center;
        min-height: 1.45em;
      }

      #page-squadron .gate-squadron-subtitle span:not(:last-child)::after {
        content: '•';
        margin-left: 0.72rem;
        color: rgba(125, 211, 252, 0.52);
      }

      #page-squadron .gate-squadron-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.62rem;
        width: fit-content;
        max-width: calc(100vw - 2rem);
        margin: 0 auto;
        padding: 0.44rem;
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 999px;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11), 0 8px 20px rgba(0, 0, 0, 0.16);
        -webkit-backdrop-filter: blur(16px) saturate(1.12);
        backdrop-filter: blur(16px) saturate(1.12);
      }

      #page-squadron .gate-squadron-metric {
        display: grid;
        grid-template-columns: auto auto;
        align-items: baseline;
        gap: 0.42rem;
        min-width: 0;
        padding: 0.45rem 0.74rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.085);
        background: rgba(255, 255, 255, 0.045);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }

      #page-squadron .gate-squadron-metric-label {
        color: var(--text-muted);
        font-size: 0.62rem;
        font-weight: 950;
        letter-spacing: 0.115em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      #page-squadron .gate-squadron-metric-value {
        color: var(--text);
        font-size: clamp(1.25rem, 2.15vw, 1.92rem);
        font-weight: 950;
        letter-spacing: -0.055em;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      #page-squadron .dorm-dashboard { flex: 1 1 auto; min-height: 0; }

      .theme-light #page-squadron .gate-squadron-masthead,
      .theme-light #page-squadron .gate-squadron-header {
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.46));
        border-color: rgba(2, 132, 199, 0.16);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.80), 0 8px 20px rgba(15, 23, 42, 0.08);
      }

      .theme-light #page-squadron .gate-squadron-metric {
        background: rgba(255, 255, 255, 0.56);
        border-color: rgba(100, 116, 139, 0.14);
      }

      .prc-active-buses-v3 #active-buses,
      #page-board #active-buses {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 0.72rem !important;
        align-items: stretch !important;
        align-content: flex-start !important;
      }

      #page-board #active-buses .bus-badge.prc-bus-card {
        width: 148px !important;
        min-width: 148px !important;
        min-height: 146px !important;
        padding: 0.76rem 0.84rem !important;
        border-radius: 1.05rem !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: center !important;
        gap: 0.2rem !important;
        text-align: left !important;
        white-space: normal !important;
        line-height: 1.04 !important;
      }

      #page-board #active-buses .prc-bus-card-title,
      #page-board #active-buses .prc-bus-card-line,
      #page-board #active-buses .prc-bus-card-dept { display: block !important; text-transform: uppercase; }
      #page-board #active-buses .prc-bus-card-title { font-size: 1.08rem !important; font-weight: 950 !important; color: var(--text) !important; }
      #page-board #active-buses .prc-bus-card-line { font-size: 0.84rem !important; font-weight: 900 !important; color: var(--text-soft, var(--text-muted)) !important; }
      #page-board #active-buses .prc-bus-card-dept { width: 100% !important; margin-top: 0.28rem !important; padding-top: 0.28rem !important; border-top: 1px solid rgba(255,255,255,0.18) !important; font-size: 0.72rem !important; font-weight: 950 !important; color: var(--text-muted) !important; }

      @media (max-width: 768px) {
        #page-squadron.gate-squadron-page { padding-top: 72px !important; }
        #page-squadron .gate-squadron-masthead { width: 100%; min-height: 66px; padding: 0.96rem 0.9rem 0.86rem; }
        #page-squadron .gate-squadron-subtitle { font-size: 0.92rem; letter-spacing: 0.12em; }
        #page-squadron .gate-squadron-header { width: 100%; border-radius: 1rem; flex-wrap: wrap; }
        #page-squadron .gate-squadron-metric { flex: 1 1 160px; justify-content: center; }
        #page-squadron .dorm-dashboard { grid-template-columns: 1fr; overflow-y: auto; }
      }
    `;

    document.head.appendChild(style);
    stylesReady = true;
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

  function getDormStatusLabel(dorm) {
    if (!dorm) return '';
    if (dorm.state === 'closed') return 'CLOSED';
    if (dorm.state === 'empty') return 'EMPTY';
    return String(dorm.phase || 'OPEN').trim() || 'OPEN';
  }

  function isFemaleDorm(dorm) {
    const sex = String(dorm?.sex || '').trim().toLowerCase();
    return sex === 'female' || sex === 'f';
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

  function getLoadRatio(dorm) {
    const current = n(dorm.current_load);
    const max = n(dorm.max_load);
    const width = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    return { current, max, width, isFull: max > 0 && current === max, isOver: max > 0 && current > max };
  }

  function buildGateDormCard(dorm) {
    const load = getLoadRatio(dorm);
    const state = String(dorm.state || 'empty').toLowerCase();
    const borderClass = isFemaleDorm(dorm) ? 'border-female' : (dorm.band === 'true' ? 'border-band' : '');
    const closedClass = state === 'closed' ? 'dorm-closed' : '';
    const progressClass = load.isOver ? 'is-over' : (load.isFull ? 'is-full' : '');
    const info = [escapeText(dorm.sdq), escapeText(dorm.section), escapeText(dorm.inter_sec)].filter(Boolean).join(' · ');
    const status = getDormStatusLabel(dorm);

    let timerHtml = '<div class="gate-dorm-timer gate-empty-timer">00:00</div>';

    if (state === 'open' && dorm.opened_at) {
      const timer = typeof getElapsedTimer === 'function' ? getElapsedTimer(dorm.opened_at) : { text: '00:00' };
      timerHtml = `<div class="gate-dorm-timer timer-display" data-opened="${escapeText(dorm.opened_at)}" data-dorm-id="${escapeText(dorm.__backendId)}">${escapeText(timer.text)}</div>`;
    }

    if (state === 'closed' && dorm.closed_timer) {
      timerHtml = `<div class="gate-dorm-timer text-muted">${escapeText(dorm.closed_timer)}</div>`;
    }

    return `
      <div class="dorm-card tactical-glass-card gate-dorm-card gate-dorm-state-${escapeText(state)} ${borderClass} ${closedClass} ${progressClass}" data-state="${escapeText(state)}">
        <div class="gate-dorm-name">${escapeText(dorm.dorm_name || '')}</div>
        <div class="gate-dorm-airman">${escapeText(dorm.assigned_airman || '')}</div>
        <div class="gate-dorm-info">${info || '&nbsp;'}</div>
        <div class="gate-dorm-status-wrap">
          <div class="gate-dorm-status" data-state="${escapeText(state)}">${escapeText(status)}</div>
        </div>
        ${timerHtml}
        <div class="gate-dorm-load">${load.current} / ${load.max}</div>
        <div class="gate-dorm-progress" aria-hidden="true">
          <div class="gate-dorm-progress-fill" style="width:${load.width.toFixed(1)}%;"></div>
        </div>
      </div>
    `;
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
      col.innerHTML = filtered.map(dorm => buildGateDormCard(dorm)).join('') || '<div class="text-muted text-xs">None</div>';
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

  function ensureSquadronPage() {
    if (squadronPageReady && document.getElementById('page-squadron')) return;
    const boardPage = document.getElementById('page-board');
    if (!boardPage) return;

    if (!document.getElementById('page-squadron')) {
      boardPage.insertAdjacentHTML('afterend', `
        <main id="page-squadron" class="page gate-squadron-page" role="main" aria-label="Squadron Board">
          <div class="gate-squadron-shell">
            <section class="gate-squadron-masthead" aria-label="Squadron Board header">
              <div class="gate-squadron-subtitle">
                <span>Pfingston Reception Center</span>
                <span>Squadron Board</span>
              </div>
            </section>
            <section class="gate-squadron-header" aria-label="Squadron Board metrics">
              <div class="gate-squadron-metric">
                <div class="gate-squadron-metric-label">Arrived</div>
                <div id="squadron-metric-arrived" class="gate-squadron-metric-value">0</div>
              </div>
              <div class="gate-squadron-metric">
                <div class="gate-squadron-metric-label">Expected</div>
                <div id="squadron-metric-expected" class="gate-squadron-metric-value">0</div>
              </div>
              <div class="gate-squadron-metric">
                <div class="gate-squadron-metric-label">Local</div>
                <div id="squadron-metric-local" class="gate-squadron-metric-value">--:--</div>
              </div>
            </section>
            <div class="dorm-dashboard">
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
    const menu = document.getElementById('nav-links');
    if (!nav || !menu) return;

    nav.classList.add('command-header-bar');
    nav.setAttribute('role', 'banner');
    menu.id = 'main-nav-menu';
    menu.classList.add('nav-group-left');
    menu.setAttribute('role', 'navigation');
    menu.setAttribute('aria-label', 'Main Operational Navigation');

    const rightGroup = nav.querySelector(':scope > div:last-child');
    if (rightGroup) {
      rightGroup.classList.add('nav-group-right');
      rightGroup.setAttribute('role', 'complementary');
      rightGroup.setAttribute('aria-label', 'System Identity Control');
    }

    if (!document.getElementById('mobile-menu-trigger')) {
      const trigger = document.createElement('button');
      trigger.id = 'mobile-menu-trigger';
      trigger.type = 'button';
      trigger.className = 'tactical-nav-pill mobile-only-control';
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
        .replace(/prc\s?dash/gi, 'GATE')
        .replace(/dashboard/gi, 'Status Board');
    }
  }

  function ensureBrandingObserver() {
    if (brandingObserverReady || !document.body || typeof MutationObserver === 'undefined') return;
    scrubLegacyTerminology();
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
            container.innerHTML = pages.map(page => `<button type="button" class="nav-btn nav-link-item ${page === activeId ? 'active active-page-state current-page' : ''}" data-page="${page}" onclick="showPage('${page}')">${PAGE_LABELS[page] || page}</button>`).join('');
            container.querySelectorAll('button').forEach(button => {
              button.setAttribute('aria-current', button.dataset.page === activeId ? 'page' : 'false');
            });
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
      col.innerHTML = filtered.map(dorm => buildGateDormCard(dorm)).join('') || '<div class="text-muted text-xs">None</div>';
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
    ensureStyles();
    ensureSquadronPage();
    patchNavigationForSquadronBoard();
    patchDormRenderers();
    patchRenderAllForBoards();
    ensureResponsiveCommandShell();
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
          return Boolean(target.closest('.page, .app-nav, #active-buses, .dorm-col-content'));
        }
        return false;
      });
      if (shouldSchedule) schedulePass();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'onclick']
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
