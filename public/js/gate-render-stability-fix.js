// GATE Phase 7F render stability compatibility guard
// Visual stability is now source-owned by military-glass-terminal.css.
(function () {
  'use strict';

  let installed = false;

  function installStyles() {
    const canonical = document.querySelector('link[href^="/css/military-glass-terminal.css"]');
    if (canonical) canonical.dataset.gateRenderStability = 'true';
  }

  function start() {
    if (installed) return;
    installed = true;
    installStyles();
    window.GateRenderStabilityStyleGuard = Object.freeze({
      isStyleOnly: true,
      ownsPageState: false,
      ownsWatermark: false,
      statusBoardExcluded: true,
      refresh: installStyles
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
