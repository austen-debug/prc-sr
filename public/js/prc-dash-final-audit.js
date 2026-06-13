// PRC GATE final UI/functionality safety patch
// Consolidated Status Board / Squadron Board display helpers.
(function () {
  let stylesReady = false;
  let squadronPageReady = false;
  let navPatched = false;
  let renderAllPatched = false;
  let boardDormSignature = '';
  let squadronDormSignature = '';

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

  function ensureStyles() {
    if (stylesReady || document.getElementById('prc-gate-board-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-gate-board-styles';
    style.textContent = `
      .app-nav { display: flex; }
      .fullscreen-board .app-nav { display: none !important; }

      #page-board .gate-dorm-card,
      #page-squadron .gate-dorm-card {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) max-content !important;
        grid-template-rows: auto auto minmax(2.75rem, 1fr) auto !important;
        grid-template-areas:
          'name airman'
          'info info'
          'status status'
          'timer load' !important;
        justify-items: stretch !important;
        align-items: stretch !important;
        column-gap: 0.85rem !important;
        row-gap: 0.22rem !important;
        min-height: 156px !important;
        width: 100% !important;
        padding: 0.78rem 0.86rem 0.72rem !important;
        position: relative !important;
        overflow: hidden !important;
        text-align: left !important;
        cursor: default !important;
      }

      #page-board .gate-dorm-name,
      #page-squadron .gate-dorm-name {
        grid-area: name !important;
        justify-self: start !important;
        align-self: start !important;
        min-width: 0 !important;
        max-width: 100% !important;
        text-align: left !important;
        font-size: clamp(1.75rem, 2.45vw, 2.7rem) !important;
        font-weight: 950 !important;
        letter-spacing: -0.055em !important;
        line-height: 0.95 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      #page-board .gate-dorm-airman,
      #page-squadron .gate-dorm-airman {
        grid-area: airman !important;
        justify-self: end !important;
        align-self: start !important;
        max-width: 8.75rem !important;
        min-width: 0 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        overflow-wrap: normal !important;
        word-break: normal !important;
        hyphens: none !important;
        text-align: right !important;
        color: var(--text-muted) !important;
        font-size: 0.62rem !important;
        font-weight: 950 !important;
        letter-spacing: 0.07em !important;
        text-transform: uppercase !important;
        line-height: 1.05 !important;
        padding-top: 0.08rem !important;
      }

      #page-board .gate-dorm-info,
      #page-squadron .gate-dorm-info {
        grid-area: info !important;
        justify-self: start !important;
        align-self: start !important;
        width: 100% !important;
        max-width: 100% !important;
        text-align: left !important;
        color: var(--text-muted) !important;
        font-size: 0.72rem !important;
        font-weight: 900 !important;
        letter-spacing: 0.08em !important;
        line-height: 1.05 !important;
        text-transform: uppercase !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      #page-board .gate-dorm-status-wrap,
      #page-squadron .gate-dorm-status-wrap {
        grid-area: status !important;
        justify-self: stretch !important;
        align-self: center !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        width: 100% !important;
        min-width: 0 !important;
        padding: 0.48rem 0 !important;
      }

      #page-board .gate-dorm-status,
      #page-squadron .gate-dorm-status {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        max-width: 100% !important;
        min-height: 1.65rem !important;
        padding: 0.28rem 0.78rem !important;
        border-radius: 999px !important;
        border: 1px solid rgba(148, 163, 184, 0.26) !important;
        background: rgba(255, 255, 255, 0.055) !important;
        color: var(--text) !important;
        font-size: 0.78rem !important;
        font-weight: 950 !important;
        letter-spacing: 0.105em !important;
        text-transform: uppercase !important;
        text-align: center !important;
        line-height: 1.05 !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
      }

      #page-board .gate-dorm-status[data-state='open'],
      #page-squadron .gate-dorm-status[data-state='open'] {
        border-color: rgba(34, 197, 94, 0.36) !important;
        background: rgba(34, 197, 94, 0.12) !important;
        color: #86efac !important;
      }

      #page-board .gate-dorm-status[data-state='closed'],
      #page-squadron .gate-dorm-status[data-state='closed'],
      #page-board .gate-dorm-status[data-state='empty'],
      #page-squadron .gate-dorm-status[data-state='empty'] {
        color: var(--text-muted) !important;
      }

      #page-board .gate-dorm-timer,
      #page-squadron .gate-dorm-timer {
        grid-area: timer !important;
        justify-self: start !important;
        align-self: end !important;
        min-height: 2rem !important;
        font-size: 2.15rem !important;
        font-weight: 950 !important;
        line-height: 0.98 !important;
        letter-spacing: -0.045em !important;
        font-variant-numeric: tabular-nums !important;
        text-align: left !important;
      }

      #page-board .gate-empty-timer,
      #page-squadron .gate-empty-timer { color: transparent !important; }

      #page-board .gate-dorm-load,
      #page-squadron .gate-dorm-load {
        grid-area: load !important;
        justify-self: end !important;
        align-self: end !important;
        font-size: 1.34rem !important;
        font-weight: 950 !important;
        letter-spacing: -0.045em !important;
        line-height: 1 !important;
        font-variant-numeric: tabular-nums !important;
        color: var(--text) !important;
        white-space: nowrap !important;
        text-align: right !important;
      }

      .dorm-closed.gate-dorm-card { opacity: 0.62 !important; }
      .fullscreen-board .gate-dorm-card { min-height: 168px !important; }
      .fullscreen-board .gate-dorm-timer { font-size: 2.34rem !important; }
      .theme-light .gate-dorm-status[data-state='open'] { color: #166534 !important; }
      .theme-light .gate-dorm-status[data-state='closed'],
      .theme-light .gate-dorm-status[data-state='empty'] { color: #64748b !important; }

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
        .gate-squadron-header { grid-template-columns: 1fr; }
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

  function getDormNameColor(dorm) {
    const currentLoad = n(dorm.current_load);
    const maxLoad = n(dorm.max_load);
    if (dorm.state === 'empty' || dorm.state === 'closed') return 'var(--text-muted)';
    if (maxLoad > 0 && currentLoad >= maxLoad) return 'var(--green)';
    return 'var(--text)';
  }

  function getDormSignature(dorms) {
    return dorms.map(dorm => [
      dorm.__backendId,
      dorm.dorm_name,
      dorm.assigned_airman,
      dorm.sdq,
      dorm.section,
      dorm.inter_sec,
      dorm.sex,
      dorm.band,
      dorm.state,
      dorm.phase,
      dorm.current_load,
      dorm.max_load,
      dorm.opened_at,
      dorm.closed_timer
    ].join('|')).join('~');
  }

  function cardStyle() {
    return [
      'display:grid !important',
      'grid-template-columns:minmax(0,1fr) max-content !important',
      'grid-template-rows:auto auto minmax(2.75rem,1fr) auto !important',
      "grid-template-areas:'name airman' 'info info' 'status status' 'timer load' !important",
      'justify-items:stretch !important',
      'align-items:stretch !important',
      'column-gap:0.85rem !important',
      'row-gap:0.22rem !important',
      'min-height:156px !important',
      'width:100% !important',
      'padding:0.78rem 0.86rem 0.72rem !important',
      'position:relative !important',
      'overflow:hidden !important',
      'text-align:left !important',
      'cursor:default !important'
    ].join(';');
  }

  function buildGateDormCard(dorm) {
    const borderClass = dorm.sex === 'female' ? 'border-female' : (dorm.band === 'true' ? 'border-band' : '');
    const closedClass = dorm.state === 'closed' ? 'dorm-closed' : '';
    const info = [escapeText(dorm.sdq), escapeText(dorm.section), escapeText(dorm.inter_sec)].filter(Boolean).join(' · ');
    const status = getDormStatusLabel(dorm);
    const nameColor = getDormNameColor(dorm);

    let timerHtml = `<div class="gate-dorm-timer gate-empty-timer" style="grid-area:timer;justify-self:start;align-self:end;min-height:2rem;font-size:2.15rem;font-weight:950;line-height:.98;letter-spacing:-.045em;font-variant-numeric:tabular-nums;text-align:left;color:transparent;">00:00</div>`;

    if (dorm.state === 'open' && dorm.opened_at) {
      const timer = typeof getElapsedTimer === 'function' ? getElapsedTimer(dorm.opened_at) : { text: '00:00' };
      timerHtml = `<div class="gate-dorm-timer timer-display" data-opened="${escapeText(dorm.opened_at)}" data-dorm-id="${escapeText(dorm.__backendId)}" style="grid-area:timer;justify-self:start;align-self:end;min-height:2rem;font-size:2.15rem;font-weight:950;line-height:.98;letter-spacing:-.045em;font-variant-numeric:tabular-nums;text-align:left;">${escapeText(timer.text)}</div>`;
    }

    if (dorm.state === 'closed' && dorm.closed_timer) {
      timerHtml = `<div class="gate-dorm-timer text-muted" style="grid-area:timer;justify-self:start;align-self:end;min-height:2rem;font-size:2.15rem;font-weight:950;line-height:.98;letter-spacing:-.045em;font-variant-numeric:tabular-nums;text-align:left;">${escapeText(dorm.closed_timer)}</div>`;
    }

    return `
      <div class="dorm-card gate-dorm-card ${borderClass} ${closedClass}" style="${cardStyle()}">
        <div class="gate-dorm-name" style="grid-area:name;justify-self:start;align-self:start;min-width:0;max-width:100%;text-align:left;font-size:clamp(1.75rem,2.45vw,2.7rem);font-weight:950;letter-spacing:-.055em;line-height:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${nameColor};">${escapeText(dorm.dorm_name || '')}</div>
        <div class="gate-dorm-airman" style="grid-area:airman;justify-self:end;align-self:start;max-width:8.75rem;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;color:var(--text-muted);font-size:.62rem;font-weight:950;letter-spacing:.07em;text-transform:uppercase;line-height:1.05;padding-top:.08rem;">${escapeText(dorm.assigned_airman || '')}</div>
        <div class="gate-dorm-info" style="grid-area:info;justify-self:start;align-self:start;width:100%;max-width:100%;text-align:left;color:var(--text-muted);font-size:.72rem;font-weight:900;letter-spacing:.08em;line-height:1.05;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${info || '&nbsp;'}</div>
        <div class="gate-dorm-status-wrap" style="grid-area:status;justify-self:stretch;align-self:center;display:flex;justify-content:center;align-items:center;width:100%;min-width:0;padding:.48rem 0;">
          <div class="gate-dorm-status" data-state="${escapeText(dorm.state || '')}">${escapeText(status)}</div>
        </div>
        ${timerHtml}
        <div class="gate-dorm-load" style="grid-area:load;justify-self:end;align-self:end;font-size:1.34rem;font-weight:950;letter-spacing:-.045em;line-height:1;font-variant-numeric:tabular-nums;color:var(--text);white-space:nowrap;text-align:right;">${n(dorm.current_load)} / ${n(dorm.max_load)}</div>
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
          <div class="gate-squadron-title">
            <h2>Squadron Board</h2>
            <div class="gate-system-label">PRC GATE</div>
          </div>
          <div class="gate-squadron-header">
            <div class="metric-block"><div class="text-xs uppercase tracking-wider font-medium text-muted">Arrived</div><div id="squadron-metric-arrived" class="text-2xl font-black font-tabular mt-1">0</div></div>
            <div class="metric-block"><div class="text-xs uppercase tracking-wider font-medium text-muted">Expected</div><div id="squadron-metric-expected" class="text-2xl font-black font-tabular mt-1">0</div></div>
            <div class="metric-block"><div class="text-xs uppercase tracking-wider font-medium text-muted">Local</div><div id="squadron-metric-local" class="text-2xl font-black font-tabular mt-1">--:--</div></div>
          </div>
          <div class="dorm-dashboard">
            <div class="dorm-column"><div class="dorm-col-header">Empty</div><div id="squadron-col-empty" class="dorm-col-content"></div></div>
            <div class="dorm-column"><div class="dorm-col-header">Open</div><div id="squadron-col-open" class="dorm-col-content"></div></div>
            <div class="dorm-column"><div class="dorm-col-header">Closed</div><div id="squadron-col-closed" class="dorm-col-content"></div></div>
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

  function normalizeActiveBusCards() {
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
    ensureStyles();
    ensureSquadronPage();
    patchNavigationForSquadronBoard();
    patchDormRenderers();
    patchRenderAllForBoards();
    try { keepNavigationRecoverable(); } catch (error) { console.warn('PRC GATE nav recovery failed:', error); }
    try { renderGateDormColumns(); } catch (error) { console.warn('PRC GATE Status Board render failed:', error); }
    try { renderSquadronBoard(); } catch (error) { console.warn('PRC GATE Squadron Board render failed:', error); }
    try { normalizeActiveBusCards(); } catch (error) { console.warn('PRC GATE active bus render failed:', error); }
  }

  function start() {
    runPass();
    setInterval(runPass, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();