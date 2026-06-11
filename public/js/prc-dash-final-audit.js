// PRC GATE final UI/functionality safety patch
// Loaded last. Keeps display-only patches from competing and prevents stale fullscreen state from hiding navigation.
(function () {
  let styleReady = false;
  let squadronPageReady = false;
  let navPatched = false;
  let dormCardPatched = false;
  let renderAllPatched = false;

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

  function ensureFinalStyles() {
    if (styleReady || document.getElementById('prc-final-audit-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-final-audit-styles';
    style.textContent = `
      .app-nav { display: flex; }
      .fullscreen-board .app-nav { display: none !important; }

      .prc-active-buses-v3 #active-buses {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 0.72rem !important;
        align-items: stretch !important;
        align-content: flex-start !important;
      }

      .prc-active-buses-v3 #active-buses .bus-badge.prc-bus-card,
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

      #page-board #active-buses .prc-bus-card-title {
        display: block !important;
        font-size: 1.08rem !important;
        font-weight: 950 !important;
        letter-spacing: 0.045em !important;
        line-height: 1 !important;
        color: var(--text) !important;
        text-transform: uppercase;
      }

      #page-board #active-buses .prc-bus-card-line {
        display: block !important;
        font-size: 0.84rem !important;
        font-weight: 900 !important;
        letter-spacing: 0.035em !important;
        line-height: 1.08 !important;
        color: var(--text-soft, var(--text-muted)) !important;
        text-transform: uppercase;
      }

      #page-board #active-buses .prc-bus-card-dept {
        display: block !important;
        width: 100% !important;
        margin-top: 0.28rem !important;
        padding-top: 0.28rem !important;
        border-top: 1px solid rgba(255,255,255,0.18) !important;
        font-size: 0.72rem !important;
        font-weight: 950 !important;
        letter-spacing: 0.065em !important;
        color: var(--text-muted) !important;
        text-transform: uppercase;
      }

      .theme-light #page-board #active-buses .prc-bus-card-title { color: #0f172a !important; }
      .theme-light #page-board #active-buses .prc-bus-card-line { color: #334155 !important; }
      .theme-light #page-board #active-buses .prc-bus-card-dept { border-top-color: rgba(100,116,139,0.24) !important; }

      #page-squadron.gate-squadron-page {
        padding-top: 80px;
        padding-bottom: 0.75rem;
        min-height: 100vh;
        overflow: hidden;
      }

      .gate-squadron-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.25rem 0.75rem 0;
      }

      .gate-squadron-title h2,
      .gate-squadron-title .gate-system-label {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.74rem;
        font-weight: 950;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .gate-squadron-header {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        padding: 0.75rem;
        flex-shrink: 0;
      }

      .gate-dorm-card {
        min-height: 156px;
        display: grid !important;
        grid-template-rows: auto auto 1fr auto;
        align-items: stretch !important;
        gap: 0.18rem;
        padding: 0.78rem 0.86rem 0.72rem !important;
        position: relative;
        overflow: hidden;
        cursor: default !important;
      }

      .gate-dorm-card .gate-dorm-top {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        gap: 0.55rem;
        min-width: 0;
      }

      .gate-dorm-card .gate-dorm-name {
        min-width: 0;
        font-size: clamp(1.75rem, 2.45vw, 2.7rem);
        font-weight: 950;
        letter-spacing: -0.055em;
        line-height: 0.95;
        overflow-wrap: anywhere;
      }

      .gate-dorm-card .gate-dorm-airman {
        max-width: 45%;
        font-size: 0.62rem;
        font-weight: 950;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        text-align: right;
        color: var(--text-muted);
        line-height: 1.05;
        padding-top: 0.08rem;
        overflow-wrap: anywhere;
      }

      .gate-dorm-card .gate-dorm-info {
        justify-self: start;
        text-align: left;
        font-size: 0.72rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-muted);
        line-height: 1.05;
        margin-top: 0.08rem;
      }

      .gate-dorm-card .gate-dorm-status-wrap {
        align-self: center;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0.28rem 0;
      }

      .gate-dorm-card .gate-dorm-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        max-width: 100%;
        min-height: 1.65rem;
        padding: 0.28rem 0.78rem;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.26);
        background: rgba(255, 255, 255, 0.055);
        color: var(--text);
        font-size: 0.78rem;
        font-weight: 950;
        letter-spacing: 0.105em;
        text-transform: uppercase;
        text-align: center;
        line-height: 1.05;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }

      .gate-dorm-card .gate-dorm-status[data-state='open'] {
        border-color: rgba(34, 197, 94, 0.36);
        background: rgba(34, 197, 94, 0.12);
        color: #86efac;
      }

      .gate-dorm-card .gate-dorm-status[data-state='closed'] {
        border-color: rgba(148, 163, 184, 0.24);
        background: rgba(148, 163, 184, 0.08);
        color: var(--text-muted);
      }

      .gate-dorm-card .gate-dorm-status[data-state='empty'] {
        border-color: rgba(148, 163, 184, 0.18);
        background: rgba(148, 163, 184, 0.055);
        color: var(--text-muted);
      }

      .gate-dorm-card .gate-dorm-bottom {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: 0.65rem;
        min-width: 0;
      }

      .gate-dorm-card .gate-dorm-timer {
        justify-self: start;
        min-height: 2rem;
        font-size: 2.15rem;
        font-weight: 950;
        line-height: 0.98;
        letter-spacing: -0.045em;
        font-variant-numeric: tabular-nums;
      }

      .gate-dorm-card .gate-dorm-timer.gate-empty-timer {
        color: transparent;
      }

      .gate-dorm-card .gate-dorm-load {
        justify-self: end;
        font-size: 1.34rem;
        font-weight: 950;
        letter-spacing: -0.045em;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: var(--text);
        white-space: nowrap;
      }

      .dorm-closed.gate-dorm-card {
        opacity: 0.62;
      }

      .fullscreen-board .gate-dorm-card {
        min-height: 168px;
      }

      .fullscreen-board .gate-dorm-card .gate-dorm-timer {
        font-size: 2.34rem;
      }

      .theme-light .gate-dorm-card .gate-dorm-status[data-state='open'] {
        color: #166534;
      }

      .theme-light .gate-dorm-card .gate-dorm-status[data-state='closed'],
      .theme-light .gate-dorm-card .gate-dorm-status[data-state='empty'] {
        color: #64748b;
      }

      @media (max-width: 768px) {
        .prc-active-buses-v3 #active-buses .bus-badge.prc-bus-card,
        #page-board #active-buses .bus-badge.prc-bus-card {
          width: 136px !important;
          min-width: 136px !important;
          min-height: 136px !important;
          padding: 0.66rem 0.72rem !important;
        }

        .gate-squadron-header {
          grid-template-columns: 1fr;
        }

        #page-squadron .dorm-dashboard {
          grid-template-columns: 1fr;
          overflow-y: auto;
        }
      }
    `;

    document.head.appendChild(style);
    styleReady = true;
  }

  function getActiveWeekGroupSafe() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function getDormsForActiveWeek() {
    try {
      if (typeof getRecords !== 'function') return [];
      const wg = getActiveWeekGroupSafe();
      return getRecords('dorm').filter(dorm => dorm.week_group === wg);
    } catch (_) {
      return [];
    }
  }

  function getBusesForActiveWeek() {
    try {
      if (typeof getRecords !== 'function') return [];
      const wg = getActiveWeekGroupSafe();
      return getRecords('bus').filter(bus => bus.week_group === wg);
    } catch (_) {
      return [];
    }
  }

  function getDormStatusLabel(dorm) {
    if (!dorm) return '';
    if (dorm.state === 'closed') return 'CLOSED';
    if (dorm.state === 'empty') return 'EMPTY';
    return String(dorm.phase || 'OPEN').trim() || 'OPEN';
  }

  function getDormNameColor(dorm) {
    const currentLoad = n(dorm.current_load);
    const maxLoad = n(dorm.max_load);
    const isFull = maxLoad > 0 && currentLoad >= maxLoad;

    if (dorm.state === 'empty') return 'var(--text-muted)';
    if (dorm.state === 'closed') return 'var(--text-muted)';
    if (dorm.state === 'open' && isFull) return 'var(--green)';
    return 'var(--text)';
  }

  function buildGateDormCard(dorm) {
    const borderClass = dorm.sex === 'female' ? 'border-female' : (dorm.band === 'true' ? 'border-band' : '');
    const closedClass = dorm.state === 'closed' ? 'dorm-closed' : '';
    const info = [escapeText(dorm.sdq), escapeText(dorm.section), escapeText(dorm.inter_sec)].filter(Boolean).join(' · ');
    const status = getDormStatusLabel(dorm);
    const nameColor = getDormNameColor(dorm);

    let timerHtml = '<div class="gate-dorm-timer gate-empty-timer">00:00</div>';

    if (dorm.state === 'open' && dorm.opened_at) {
      const timer = typeof getElapsedTimer === 'function' ? getElapsedTimer(dorm.opened_at) : { text: '00:00' };
      timerHtml = `<div class="gate-dorm-timer timer-display" data-opened="${escapeText(dorm.opened_at)}" data-dorm-id="${escapeText(dorm.__backendId)}">${escapeText(timer.text)}</div>`;
    }

    if (dorm.state === 'closed' && dorm.closed_timer) {
      timerHtml = `<div class="gate-dorm-timer text-muted">${escapeText(dorm.closed_timer)}</div>`;
    }

    return `
      <div class="dorm-card gate-dorm-card ${borderClass} ${closedClass}" style="cursor:default;">
        <div class="gate-dorm-top">
          <div class="gate-dorm-name" style="color:${nameColor};">${escapeText(dorm.dorm_name || '')}</div>
          <div class="gate-dorm-airman">${escapeText(dorm.assigned_airman || '')}</div>
        </div>
        <div class="gate-dorm-info">${info || '&nbsp;'}</div>
        <div class="gate-dorm-status-wrap">
          <div class="gate-dorm-status" data-state="${escapeText(dorm.state || '')}">${escapeText(status)}</div>
        </div>
        <div class="gate-dorm-bottom">
          ${timerHtml}
          <div class="gate-dorm-load">${n(dorm.current_load)} / ${n(dorm.max_load)}</div>
        </div>
      </div>
    `;
  }

  function patchDormCardRenderer() {
    try {
      if (dormCardPatched || typeof buildBoardDormCard !== 'function') return;
      window.buildBoardDormCard = buildGateDormCard;
      try { buildBoardDormCard = buildGateDormCard; } catch (_) {}
      dormCardPatched = true;
    } catch (error) {
      console.warn('PRC GATE dorm card renderer patch failed:', error);
    }
  }

  function ensureSquadronPage() {
    if (squadronPageReady && document.getElementById('page-squadron')) return;

    const boardPage = document.getElementById('page-board');
    if (!boardPage) return;

    const existing = document.getElementById('page-squadron');
    if (!existing) {
      boardPage.insertAdjacentHTML('afterend', `
        <main id="page-squadron" class="page gate-squadron-page" role="main" aria-label="Squadron Board">
          <div class="gate-squadron-title">
            <h2>Squadron Board</h2>
            <div class="gate-system-label">PRC GATE</div>
          </div>
          <div class="gate-squadron-header">
            <div class="metric-block">
              <div class="text-xs uppercase tracking-wider font-medium text-muted">Arrived</div>
              <div id="squadron-metric-arrived" class="text-2xl font-black font-tabular mt-1">0</div>
            </div>
            <div class="metric-block">
              <div class="text-xs uppercase tracking-wider font-medium text-muted">Expected</div>
              <div id="squadron-metric-expected" class="text-2xl font-black font-tabular mt-1">0</div>
            </div>
            <div class="metric-block">
              <div class="text-xs uppercase tracking-wider font-medium text-muted">Local</div>
              <div id="squadron-metric-local" class="text-2xl font-black font-tabular mt-1">--:--</div>
            </div>
          </div>
          <div class="dorm-dashboard">
            <div class="dorm-column">
              <div class="dorm-col-header">Empty</div>
              <div id="squadron-col-empty" class="dorm-col-content"></div>
            </div>
            <div class="dorm-column">
              <div class="dorm-col-header">Open</div>
              <div id="squadron-col-open" class="dorm-col-content"></div>
            </div>
            <div class="dorm-column">
              <div class="dorm-col-header">Closed</div>
              <div id="squadron-col-closed" class="dorm-col-content"></div>
            </div>
          </div>
        </main>
      `);
    }

    squadronPageReady = true;
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
          const container = document.getElementById('nav-links');
          const activePage = document.querySelector('.page.active');
          const activeId = activePage ? activePage.id.replace('page-', '') : (currentRole === 'squadron' ? 'squadron' : 'board');

          if (container) {
            container.innerHTML = pages.map(page => `<button class="nav-btn ${page === activeId ? 'active' : ''}" onclick="showPage('${page}')">${PAGE_LABELS[page] || page}</button>`).join('');
          }

          const roleButton = document.getElementById('role-toggle');
          if (roleButton) {
            roleButton.textContent = currentRole === 'instructor'
              ? 'INSTRUCTOR / LOGOUT'
              : (currentRole === 'squadron' ? 'SQUADRON / LOGOUT' : 'AIRMAN / LOGOUT');
          }

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

  function renderSquadronBoard() {
    ensureSquadronPage();
    if (!document.getElementById('page-squadron')) return;

    const dorms = getDormsForActiveWeek();
    const buses = getBusesForActiveWeek();
    const expected = dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    const arrived = buses
      .filter(bus => bus.status === 'arrived')
      .reduce((sum, bus) => sum + n(bus.otw_count), 0);

    const arrivedEl = document.getElementById('squadron-metric-arrived');
    const expectedEl = document.getElementById('squadron-metric-expected');
    const localEl = document.getElementById('squadron-metric-local');

    if (arrivedEl) arrivedEl.textContent = String(arrived);
    if (expectedEl) expectedEl.textContent = String(expected);
    if (localEl) localEl.textContent = typeof getLocalTime24 === 'function' ? getLocalTime24() : formatTime(new Date().toISOString());

    ['empty', 'open', 'closed'].forEach(state => {
      const col = document.getElementById(`squadron-col-${state}`);
      if (!col) return;
      const filtered = dorms.filter(dorm => dorm.state === state);
      col.innerHTML = filtered.map(dorm => buildGateDormCard(dorm)).join('') || '<div class="text-muted text-xs">None</div>';
    });
  }

  function patchRenderAllForSquadronBoard() {
    try {
      if (renderAllPatched || typeof renderAll !== 'function') return;
      const originalRenderAll = renderAll;
      const patchedRenderAll = function patchedRenderAll(...args) {
        const result = originalRenderAll.apply(this, args);
        renderSquadronBoard();
        return result;
      };

      window.renderAll = patchedRenderAll;
      try { renderAll = patchedRenderAll; } catch (_) {}
      renderAllPatched = true;
    } catch (error) {
      console.warn('PRC GATE Squadron Board render patch failed:', error);
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
    } catch (error) {
      return null;
    }
  }

  function busTitle(bus) {
    if (bus.bus_type === 'local') {
      return `LOCAL – ${String(bus.destination || bus.originating_destination || 'LOCAL').trim()}`;
    }
    return `BUS #${String(bus.bus_id || '').trim()}`;
  }

  function normalizeActiveBusCards() {
    ensureFinalStyles();

    const container = document.getElementById('active-buses');
    if (!container) return;

    container.querySelectorAll('.bus-badge').forEach(button => {
      const bus = getBusFromButton(button);
      if (!bus) return;

      const title = busTitle(bus);
      const otw = n(bus.otw_count);
      const females = n(bus.female_count);
      const nat = n(bus.nat_count);
      const sf = n(bus.space_force_count);
      const departed = formatTime(bus.departed_at || bus.created_at);

      // Match the older formatter's signature so it treats this final display as current
      // and does not overwrite the Space Force/departure lines on the next pass.
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
    const nav = document.querySelector('.app-nav');
    if (!nav) return;

    // If the browser is not actually in fullscreen, the board shell should not keep
    // the app-nav hidden. This protects against stale fullscreen-board state after TV use.
    if (!document.fullscreenElement && document.body.classList.contains('fullscreen-board')) {
      document.body.classList.remove('fullscreen-board');
      const btn = document.getElementById('fullscreen-btn');
      if (btn) btn.textContent = 'FULL SCREEN';
    }
  }

  function runFinalAuditPass() {
    ensureFinalStyles();
    ensureSquadronPage();
    patchNavigationForSquadronBoard();
    patchDormCardRenderer();
    patchRenderAllForSquadronBoard();
    try { keepNavigationRecoverable(); } catch (error) { console.warn('PRC GATE nav recovery check failed:', error); }
    try { normalizeActiveBusCards(); } catch (error) { console.warn('PRC GATE final active bus card pass failed:', error); }
    try { renderSquadronBoard(); } catch (error) { console.warn('PRC GATE Squadron Board render failed:', error); }
  }

  function startFinalAuditPatch() {
    runFinalAuditPass();
    setInterval(runFinalAuditPass, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startFinalAuditPatch);
  } else {
    startFinalAuditPatch();
  }
})();