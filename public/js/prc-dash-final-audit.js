// GATE Dorm Board Compatibility Controller
// Phase 1C: Status Board dorm columns and active buses are owned by gate-status-board-controller.js.
// This file now owns Squadron Board support, document identity, and close-dorm final-time safety only.
(function () {
  'use strict';

  let installed = false;
  let passScheduled = false;
  let closeDormPatched = false;
  let squadronSignature = '';

  function components() {
    return window.GateComponents || null;
  }

  function recordDisplay() {
    return window.GateRecordDisplay || null;
  }

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function esc(value) {
    const helper = components()?.esc;
    if (helper) return helper(value);
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
    return recordDisplay()?.sortDorms ? recordDisplay().sortDorms(dorms) : dorms;
  }

  function busesForActiveWeek() {
    const wg = activeWeekGroup();
    return recordsByType('bus').filter(bus => !wg || bus.week_group === wg);
  }

  function dormSignature(dorms, buses) {
    const dormPart = dorms.map(dorm => [
      dorm.__backendId,
      dorm.display_order,
      dorm.input_order,
      dorm.source_row_index,
      dorm.row_index,
      dorm.created_at,
      dorm.dorm_name,
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
      dorm.closed_timer
    ].join('|')).join('~');

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

  function statusMetricMarkup(id, label, value) {
    const contract = components();
    if (contract?.statusMetric) return contract.statusMetric({ id, label, value });
    return `<div class="gate-squadron-metric" data-component="status-metric"><div class="gate-squadron-metric-label">${esc(label)}</div><div id="${esc(id)}" class="gate-squadron-metric-value">${esc(value)}</div></div>`;
  }

  function ensureSquadronPage() {
    const boardPage = document.getElementById('page-board');
    if (!boardPage) return;

    let page = document.getElementById('page-squadron');
    if (!page) {
      boardPage.insertAdjacentHTML('afterend', `
        <main id="page-squadron" class="page gate-squadron-page" role="main" aria-label="Squadron Board" data-component="squadron-board" data-owner="gate-squadron-board-controller">
          <div class="gate-squadron-shell">
            <section class="gate-squadron-masthead" aria-label="Squadron Board header">
              <div class="gate-squadron-subtitle">
                <span>Pfingston Reception Center</span>
                <span>Squadron Board</span>
              </div>
            </section>
            <section class="gate-squadron-header" aria-label="Squadron Board metrics" data-component="status-metric-group" data-owner="gate-squadron-board-controller">
              ${statusMetricMarkup('squadron-metric-arrived', 'Arrived', '0')}
              ${statusMetricMarkup('squadron-metric-expected', 'Expected', '0')}
              ${statusMetricMarkup('squadron-metric-local', 'Local', '--:--')}
            </section>
            <div class="dorm-dashboard" data-component="dorm-column-grid" data-owner="gate-squadron-board-controller">
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
      page.dataset.owner = 'gate-squadron-board-controller';
    }
  }

  function renderDormColumnSet(prefix, dorms) {
    ['empty', 'open', 'closed'].forEach(state => {
      const col = document.getElementById(`${prefix}-${state}`);
      if (!col) return;

      const filtered = dorms.filter(dorm => String(dorm.state || 'empty').toLowerCase() === state);
      col.dataset.component = 'squadron-dorm-column';
      col.dataset.owner = 'gate-squadron-board-controller';
      col.dataset.state = state;
      col.dataset.count = String(filtered.length);

      col.innerHTML = filtered.length
        ? filtered.map(dorm => {
            const card = components()?.dormCard
              ? components().dormCard(dorm, { hideAirman: true, showAuditorium: false })
              : `<div class="dorm-card gate-dorm-card"><div class="gate-dorm-name">${esc(dorm.dorm_name || '')}</div></div>`;
            return card.replace('data-component="dorm-card"', 'data-component="dorm-card" data-owner="gate-squadron-board-controller"');
          }).join('')
        : '<div class="text-muted text-xs" data-owner="gate-squadron-board-controller" data-empty-state="true">None</div>';
    });
  }

  function renderSquadronBoard(options = {}) {
    ensureSquadronPage();
    if (!document.getElementById('page-squadron')) return;

    const dorms = dormsForActiveWeek();
    const buses = busesForActiveWeek();
    const expected = dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    const arrived = buses.filter(bus => bus.status === 'arrived').reduce((sum, bus) => sum + n(bus.otw_count), 0);

    const arrivedEl = document.getElementById('squadron-metric-arrived');
    const expectedEl = document.getElementById('squadron-metric-expected');
    const localEl = document.getElementById('squadron-metric-local');
    if (arrivedEl) arrivedEl.textContent = String(arrived);
    if (expectedEl) expectedEl.textContent = String(expected);
    if (localEl) localEl.textContent = typeof getLocalTime24 === 'function' ? getLocalTime24() : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const signature = dormSignature(dorms, buses);
    if (!options.force && signature === squadronSignature) return;
    squadronSignature = signature;
    renderDormColumnSet('squadron-col', dorms);
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
    components()?.processingDormModalContract?.();
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