// GATE Status Board header compatibility layer
// The canonical Status Board metrics are now owned by gate-premium-metrics-controller.js.
// This file intentionally no longer builds a second four-card header.
(function () {
  'use strict';

  function removeLegacyV3Header() {
    const header = document.querySelector('#page-board .board-header');
    if (!header) return;

    header.querySelectorAll('.prc-metric-grid-v3, .prc-metric-card-v3').forEach(element => element.remove());
    header.querySelectorAll('.prc-header-legacy-v3').forEach(legacy => {
      const arrivedBlock = legacy.querySelector('#metric-arrived')?.closest('.metric-block');
      const airportBlock = legacy.querySelector('#metric-airport')?.closest('.metric-block');
      if (arrivedBlock && !document.getElementById('gate-metric-compat-sinks')) arrivedBlock.remove();
      if (airportBlock && !document.getElementById('gate-metric-compat-sinks')) airportBlock.remove();
      legacy.remove();
    });

    header.classList.remove('prc-header-v3');
    header.classList.add('gate-premium-metrics-enabled');
  }

  function schedule() {
    requestAnimationFrame(removeLegacyV3Header);
  }

  function start() {
    schedule();
    window.registerGateHook?.('afterRenderAll', schedule);
    window.registerGateHook?.('afterDataChanged', schedule);
    window.registerGateHook?.('afterPageChange', schedule);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
