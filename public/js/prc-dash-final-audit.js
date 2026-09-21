// GATE Dorm Board Compatibility Controller
// Status Board is owned by gate-status-board-controller.js. This file owns the instructor-visible
// Squadron Board, document identity, and close-dorm final-time safety.
(function () {
  'use strict';

  let installed = false;
  let passScheduled = false;
  let closeDormPatched = false;
  let squadronSignature = '';
  let clockTimer = null;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function bool(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  function esc(value) {
    if (typeof window.GateComponents?.esc === 'function') return window.GateComponents.esc(value);
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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

  function activeWeekGroup() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function recordsByType(type) {
    try {
      if (typeof getRecords === 'function') return getRecords(type);
      if (Array.isArray(allData)) return allData.filter(record => record.type === type);
    } catch (_) {}
    return [];
  }

  function dormsForActiveWeek() {
    const wg = activeWeekGroup();
    const dorms = recordsByType('dorm').filter(dorm => !wg || dorm.week_group === wg);
    if (window.GateRecordDisplay?.sortDorms) return window.GateRecordDisplay.sortDorms(dorms);
    return dorms;
  }

  function airportBusesForActiveWeek() {
    const wg = activeWeekGroup();
    return recordsByType('bus')
      .filter(bus => (!wg || bus.week_group === wg) && String(bus.bus_type || '').toLowerCase() === 'airport');
  }

  function tempoFor(buses) {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    const count = buses.filter(bus => {
      const departed = new Date(bus.departed_at || '').getTime();
      return Number.isFinite(departed) && departed >= hourAgo && departed <= now;
    }).length;
    return { count, status: count >= 3 ? 'HEAVY' : (count === 2 ? 'MEDIUM' : 'SLOW') };
  }

  function time(value, seconds = false) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}), hour12: false });
  }

  function info(label, text) {
    return `<button type="button" class="gate-info" aria-label="About ${esc(label)}" data-tooltip="${esc(text)}">i</button>`;
  }

  function ensureSquadronPage() {
    const boardPage = document.getElementById('page-board');
    if (!boardPage) return;

    let page = document.getElementById('page-squadron');
    if (!page) {
      boardPage.insertAdjacentHTML('afterend', `
        <main id="page-squadron" class="page gate-squadron-page" role="main" aria-label="Squadron Board" data-component="squadron-board" data-owner="gate-squadron-board-controller">
          <div class="gate-squadron-view gate-squadron-embedded">
            <header class="gate-squadron-topbar">
              <div>
                <div class="gate-squadron-eyebrow">Pfingston Reception Center · Gateway Arrival Tracking Environment</div>
                <h2 class="gate-squadron-title">Squadron Board</h2>
                <div id="squadron-week-label" class="gate-squadron-week">NO ACTIVE WEEK GROUP</div>
              </div>
              <span class="gate-squadron-tag">READ ONLY VIEW</span>
            </header>

            <section class="gate-squadron-metrics" aria-label="Squadron Board metrics">
              <article class="gate-squadron-metric"><div class="gate-squadron-metric-head"><span class="gate-squadron-label">ARRIVED</span>${info('Arrived', 'Trainees that have arrived to the Pfingston Reception Center from the Airport')}</div><div id="squadron-metric-arrived" class="gate-squadron-value">0</div></article>
              <article class="gate-squadron-metric"><div class="gate-squadron-metric-head"><span class="gate-squadron-label">EXPECTED</span>${info('Expected', 'Total trainees expected for the active Week Group based on initialized dorm loads')}</div><div id="squadron-metric-expected" class="gate-squadron-value">0</div></article>
              <article class="gate-squadron-metric"><div class="gate-squadron-metric-head"><span class="gate-squadron-label">LOCAL TIME</span></div><div id="squadron-metric-local" class="gate-squadron-value is-time">--:--:--</div></article>
              <article class="gate-squadron-metric"><div class="gate-squadron-metric-head"><span class="gate-squadron-label">LAST UPDATE</span>${info('Last Update', 'Most recent operational update represented on this Squadron Board')}</div><div id="squadron-metric-confirmed" class="gate-squadron-value is-time">--:--</div></article>
            </section>

            <section id="squadron-traffic" class="gate-squadron-traffic" data-tempo="SLOW" aria-label="Inbound airport bus traffic">
              <div><div class="gate-squadron-traffic-title"><span>INBOUND TRAFFIC</span>${info('Inbound Traffic', 'Airport bus dispatch tempo during the rolling previous 60 minutes')}</div><div id="squadron-traffic-detail" class="gate-squadron-traffic-detail">0 airport buses dispatched in the last 60 minutes</div></div>
              <div class="gate-squadron-traffic-track" aria-hidden="true"><div class="gate-squadron-traffic-fill"></div></div>
              <div id="squadron-traffic-state" class="gate-squadron-traffic-state">SLOW</div>
            </section>

            <section class="gate-squadron-active" aria-label="Active airport buses">
              <div class="gate-squadron-section-head"><div class="gate-squadron-traffic-title"><span>ACTIVE BUSES</span>${info('Active Buses', 'Airport buses currently en route to the Pfingston Reception Center')}</div></div>
              <div id="squadron-active-buses" class="gate-squadron-active-strip"></div>
            </section>

            <section class="gate-squadron-columns" aria-label="Dorm receiving status">
              <article class="gate-squadron-column"><header class="gate-squadron-column-head"><span class="gate-squadron-column-title">EMPTY</span><span id="squadron-count-empty" class="gate-squadron-column-count">0</span></header><div id="squadron-col-empty" class="gate-squadron-column-list"></div></article>
              <article class="gate-squadron-column"><header class="gate-squadron-column-head"><span class="gate-squadron-column-title">OPEN</span><span id="squadron-count-open" class="gate-squadron-column-count">0</span></header><div id="squadron-col-open" class="gate-squadron-column-list"></div></article>
              <article class="gate-squadron-column"><header class="gate-squadron-column-head"><span class="gate-squadron-column-title">CLOSED</span><span id="squadron-count-closed" class="gate-squadron-column-count">0</span></header><div id="squadron-col-closed" class="gate-squadron-column-list"></div></article>
            </section>
          </div>
        </main>
      `);
      page = document.getElementById('page-squadron');
    }

    if (page) {
      page.dataset.component = 'squadron-board';
      page.dataset.owner = 'gate-squadron-board-controller';
    }
  }

  function renderDormCard(dorm) {
    const tags = [
      dorm.phase ? `<span class="gate-squadron-tag">${esc(dorm.phase)}</span>` : '',
      bool(dorm.band) ? '<span class="gate-squadron-tag">BAND</span>' : '',
      (bool(dorm.space_force) || bool(dorm.is_space_force)) ? '<span class="gate-squadron-tag">SPACE FORCE</span>' : ''
    ].filter(Boolean).join('');
    return `<article class="gate-squadron-dorm" data-owner="gate-squadron-board-controller">
      <div class="gate-squadron-dorm-top"><div class="gate-squadron-dorm-name">${esc(dorm.dorm_name || 'Dorm')}</div><div class="gate-squadron-dorm-load">${n(dorm.current_load)}/${n(dorm.max_load)}</div></div>
      <div class="gate-squadron-dorm-meta">${esc(dorm.sdq || 'Squadron not listed')}${dorm.section ? ` · Sec ${esc(dorm.section)}` : ''}</div>
      ${tags ? `<div class="gate-squadron-dorm-tags">${tags}</div>` : ''}
    </article>`;
  }

  function renderDormColumns(dorms) {
    ['empty', 'open', 'closed'].forEach(state => {
      const matches = dorms.filter(dorm => {
        const current = String(dorm.state || 'empty').toLowerCase();
        return (['open', 'closed'].includes(current) ? current : 'empty') === state;
      });
      const col = document.getElementById(`squadron-col-${state}`);
      const count = document.getElementById(`squadron-count-${state}`);
      if (count) count.textContent = String(matches.length);
      if (col) col.innerHTML = matches.length ? matches.map(renderDormCard).join('') : '<div class="gate-squadron-empty-message">None</div>';
    });
  }

  function latestUpdate(records) {
    const latest = records.reduce((max, record) => {
      const stamp = new Date(record.updated_at || record.created_at || 0).getTime();
      return Number.isFinite(stamp) ? Math.max(max, stamp) : max;
    }, 0);
    return latest ? new Date(latest).toISOString() : '';
  }

  function renderSquadronBoard(options = {}) {
    ensureSquadronPage();
    if (!document.getElementById('page-squadron')) return;

    const weekGroup = activeWeekGroup();
    const dorms = dormsForActiveWeek();
    const buses = airportBusesForActiveWeek();
    const expected = dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    const arrived = buses.filter(bus => String(bus.status || '').toLowerCase() === 'arrived').reduce((sum, bus) => sum + n(bus.otw_count), 0);
    const traffic = tempoFor(buses);
    const activeBuses = buses.filter(bus => ['active', 'otw'].includes(String(bus.status || '').toLowerCase()));
    const latest = latestUpdate([...dorms, ...buses]);
    const signature = JSON.stringify({ weekGroup, expected, arrived, traffic, activeBuses: activeBuses.map(bus => [bus.bus_id, bus.otw_count, bus.departed_at, bus.status]), dorms: dorms.map(dorm => [dorm.__backendId, dorm.sdq, dorm.dorm_name, dorm.section, dorm.state, dorm.phase, dorm.current_load, dorm.max_load, dorm.band, dorm.space_force, dorm.is_space_force]), latest });

    updateSquadronClock();
    if (!options.force && signature === squadronSignature) return;
    squadronSignature = signature;

    const week = document.getElementById('squadron-week-label');
    const arrivedEl = document.getElementById('squadron-metric-arrived');
    const expectedEl = document.getElementById('squadron-metric-expected');
    const confirmedEl = document.getElementById('squadron-metric-confirmed');
    if (week) week.textContent = weekGroup ? `ACTIVE · ${weekGroup}` : 'NO ACTIVE WEEK GROUP';
    if (arrivedEl) arrivedEl.textContent = String(arrived);
    if (expectedEl) expectedEl.textContent = String(expected);
    if (confirmedEl) confirmedEl.textContent = latest ? time(latest) : '--:--';

    const trafficEl = document.getElementById('squadron-traffic');
    const trafficState = document.getElementById('squadron-traffic-state');
    const trafficDetail = document.getElementById('squadron-traffic-detail');
    if (trafficEl) trafficEl.dataset.tempo = traffic.status;
    if (trafficState) trafficState.textContent = traffic.status;
    if (trafficDetail) trafficDetail.textContent = `${traffic.count} airport ${traffic.count === 1 ? 'bus' : 'buses'} dispatched in the last 60 minutes`;

    const strip = document.getElementById('squadron-active-buses');
    if (strip) {
      strip.innerHTML = activeBuses.length
        ? activeBuses.map(bus => `<div class="gate-squadron-bus"><strong>AIRPORT · BUS #${esc(bus.bus_id || '—')}</strong><span>${n(bus.otw_count)} trainees inbound</span><span>Dispatched ${esc(time(bus.departed_at || bus.created_at))}</span></div>`).join('')
        : '<div class="gate-squadron-empty-message">No airport buses currently en route.</div>';
    }
    renderDormColumns(dorms);
  }

  function updateSquadronClock() {
    const local = document.getElementById('squadron-metric-local');
    if (local) local.textContent = time(null, true);
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
    const totalSeconds = Math.max(0, Math.floor((Date.now() - opened.getTime()) / 1000));
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

        if (result?.isOk && typeof createSoundEvent === 'function') {
          await createSoundEvent('dorm_closed', {
            dorm_id: id,
            dorm_name: dorm.dorm_name || '',
            final_time: finalTime,
            action: 'close_dorm'
          });
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

  function runPass(options = {}) {
    passScheduled = false;
    ensureDocumentIdentity();
    ensureSquadronPage();
    patchCloseDormTiming();
    window.GateComponents?.processingDormModalContract?.();
    renderSquadronBoard({ force: Boolean(options.force) });
  }

  function schedulePass(options = {}) {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(() => runPass(options));
  }

  function registerHooks() {
    window.registerGateHook?.('afterRenderAll', () => schedulePass({ force: true }));
    window.registerGateHook?.('afterDataChanged', () => schedulePass({ force: true }));
    window.registerGateHook?.('afterPageChange', () => schedulePass());
  }

  function start() {
    if (installed) return;
    installed = true;
    ensureDocumentIdentity();
    ensureSquadronPage();
    patchCloseDormTiming();
    registerHooks();
    if (!clockTimer) clockTimer = window.setInterval(updateSquadronClock, 1000);
    window.GateDormBoardController = Object.freeze({
      isCanonicalOwner: false,
      handoffOwner: 'gate-status-board-controller',
      refresh: () => schedulePass({ force: true }),
      renderSquadronBoard,
      computeDormElapsedTimer
    });
    schedulePass({ force: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
