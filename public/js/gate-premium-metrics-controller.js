// GATE premium metrics controller
// Swaps the legacy Status Board metric blocks for one canonical metric grid, then updates direct stat IDs only.
(function () {
  'use strict';

  let installed = false;
  let scheduled = false;

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value ?? '—');
  }

  function parseArrivedExpected(text) {
    const source = String(text || '');
    const arrivedExpected = source.match(/ARRIVED:\s*([\d,]+)\s*\|\s*EXPECTED:\s*([\d,]+)/i);
    if (arrivedExpected) return { arrived: arrivedExpected[1], expected: arrivedExpected[2] };

    const slash = source.match(/^\s*([\d,]+)\s*\/\s*([\d,]+)/);
    if (slash) return { arrived: slash[1], expected: slash[2] };

    return { arrived: '0', expected: '0' };
  }

  function parseLastLocal(text) {
    const source = String(text || '');
    return {
      last: source.match(/LAST:\s*([^|]+)/i)?.[1]?.trim() || '00:00',
      local: source.match(/LOCAL:\s*([^|]+)/i)?.[1]?.trim() || '00:00'
    };
  }

  function canonicalMetricsHtml() {
    return `
      <div class="gate-metrics-container">
        <div class="metric-card arrived-card">
          <div class="metric-header">
            <span class="status-dot led-green" aria-hidden="true"></span>
            <span class="metric-label">ARRIVED</span>
          </div>
          <div class="metric-value" id="stat-arrived">0</div>
        </div>

        <div class="metric-card expected-card">
          <div class="metric-header">
            <span class="metric-label">EXPECTED</span>
          </div>
          <div class="metric-value" id="stat-expected">0</div>
        </div>

        <div class="metric-card last-card">
          <div class="metric-header">
            <span class="metric-label">LAST ARRIVAL</span>
          </div>
          <div class="metric-value" id="stat-last">00:00</div>
        </div>

        <div class="metric-card local-card">
          <div class="metric-header">
            <span class="metric-label">LOCAL TIME</span>
          </div>
          <div class="metric-value" id="stat-local">00:00</div>
        </div>
      </div>
    `;
  }

  function swapLegacyBlocks() {
    const boardHeader = document.querySelector('#page-board .board-header');
    if (!boardHeader) return null;

    let container = boardHeader.querySelector('.gate-metrics-container');
    if (!container) {
      const legacyArrived = document.getElementById('metric-arrived')?.closest('.metric-block');
      const legacyAirport = document.getElementById('metric-airport')?.closest('.metric-block');
      const activeBuses = document.getElementById('active-buses')?.closest('.metric-block');

      const arrivedSeed = document.getElementById('metric-arrived')?.textContent || '';
      const airportSeed = document.getElementById('metric-airport')?.textContent || '';

      const template = document.createElement('template');
      template.innerHTML = canonicalMetricsHtml().trim();
      container = template.content.firstElementChild;

      if (legacyArrived && legacyArrived.parentNode === boardHeader) {
        boardHeader.insertBefore(container, legacyArrived);
      } else {
        boardHeader.insertBefore(container, boardHeader.firstChild);
      }

      legacyArrived?.remove();
      legacyAirport?.remove();
      boardHeader.querySelectorAll('#gate-premium-metrics, .gate-premium-metrics').forEach(element => element.remove());

      activeBuses?.classList.add('gate-active-buses-block');
      boardHeader.classList.add('gate-premium-metrics-enabled');

      const arrivedData = parseArrivedExpected(arrivedSeed);
      const airportData = parseLastLocal(airportSeed);
      updateDirectStats(arrivedData, airportData);
    }

    return container;
  }

  function updateDirectStats(arrivedData, airportData) {
    setText('stat-arrived', arrivedData.arrived);
    setText('stat-expected', arrivedData.expected);
    setText('stat-last', airportData.last);
    setText('stat-local', airportData.local);
  }

  function calculateFromRecords() {
    let records = [];
    try { records = Array.isArray(allData) ? allData : []; } catch (_) { records = []; }

    let wg = '';
    try { wg = typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { wg = ''; }

    const dorms = records.filter(record => record?.type === 'dorm' && record.week_group === wg);
    const buses = records.filter(record => record?.type === 'bus' && record.week_group === wg);
    const arrivedBuses = buses.filter(bus => bus.status === 'arrived');
    const totalExpected = dorms.reduce((sum, dorm) => sum + (Number(dorm.max_load) || 0), 0);
    const totalArrived = arrivedBuses.reduce((sum, bus) => sum + (Number(bus.otw_count) || 0), 0);
    const lastAirport = records.find(record => record?.type === 'config' && record.key === 'last_airport')?.value || '—';
    const local = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    return {
      arrivedData: { arrived: totalArrived, expected: totalExpected },
      airportData: { last: lastAirport, local }
    };
  }

  function run() {
    scheduled = false;
    if (!swapLegacyBlocks()) return;
    const metrics = calculateFromRecords();
    updateDirectStats(metrics.arrivedData, metrics.airportData);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  function start() {
    if (installed) return;
    installed = true;
    window.registerGateHook?.('afterRenderAll', schedule);
    window.registerGateHook?.('afterDataChanged', schedule);
    window.registerGateHook?.('afterPageChange', schedule);
    window.setInterval(schedule, 1000);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
