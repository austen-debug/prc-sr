// GATE premium metrics controller
// Refactors the top board metrics into four Liquid Glass command telemetry cards without changing data flow.
(function () {
  'use strict';

  let installed = false;
  let scheduled = false;

  function parseArrivedExpected(text) {
    const source = String(text || '');
    const arrivedMatch = source.match(/ARRIVED:\s*([\d,]+)/i) || source.match(/^\s*([\d,]+)\s*\/\s*([\d,]+)/);
    const expectedMatch = source.match(/EXPECTED:\s*([\d,]+)/i) || source.match(/^\s*([\d,]+)\s*\/\s*([\d,]+)/);
    return {
      arrived: arrivedMatch ? arrivedMatch[1] : '0',
      expected: expectedMatch ? (expectedMatch[2] || expectedMatch[1]) : '0'
    };
  }

  function parseLastLocal(text) {
    const source = String(text || '');
    const lastMatch = source.match(/LAST:\s*([^|]+)/i);
    const localMatch = source.match(/LOCAL:\s*([^|]+)/i);
    return {
      last: lastMatch ? lastMatch[1].trim() : '—',
      local: localMatch ? localMatch[1].trim() : '—'
    };
  }

  function metricCard({ label, value, className = '', led = false }) {
    return `
      <div class="metric-card ${className}" data-gate-premium-metric="${label.toLowerCase()}">
        <div class="metric-header">
          ${led ? '<span class="status-dot led-green" aria-hidden="true"></span>' : ''}
          <span class="metric-label">${label}</span>
        </div>
        <div class="metric-value">${value}</div>
      </div>
    `;
  }

  function ensurePremiumMetrics() {
    const arrivedEl = document.getElementById('metric-arrived');
    const airportEl = document.getElementById('metric-airport');
    const activeBuses = document.getElementById('active-buses');
    const boardHeader = document.querySelector('#page-board .board-header');
    if (!arrivedEl || !airportEl || !boardHeader) return;

    const arrivedData = parseArrivedExpected(arrivedEl.textContent);
    const airportData = parseLastLocal(airportEl.textContent);

    let premium = document.getElementById('gate-premium-metrics');
    if (!premium) {
      premium = document.createElement('div');
      premium.id = 'gate-premium-metrics';
      premium.className = 'gate-premium-metrics';
      boardHeader.insertBefore(premium, boardHeader.firstChild);
    }

    premium.innerHTML = [
      metricCard({ label: 'ARRIVED', value: arrivedData.arrived, className: 'arrived-card', led: true }),
      metricCard({ label: 'EXPECTED', value: arrivedData.expected, className: 'expected-card' }),
      metricCard({ label: 'LAST', value: airportData.last, className: 'last-card' }),
      metricCard({ label: 'LOCAL', value: airportData.local, className: 'local-card' })
    ].join('');

    arrivedEl.closest('.metric-block')?.classList.add('gate-legacy-metric-source');
    airportEl.closest('.metric-block')?.classList.add('gate-legacy-metric-source');
    activeBuses?.closest('.metric-block')?.classList.add('gate-active-buses-block');
    boardHeader.classList.add('gate-premium-metrics-enabled');
  }

  function run() {
    scheduled = false;
    ensurePremiumMetrics();
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
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
