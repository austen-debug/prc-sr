// GATE access-control compatibility loader
// Phase 13 keeps this injected filename stable and loads the canonical GateAccessControlController.
(function () {
  'use strict';

  function loadController() {
    if (window.GateAccessControlController) {
      if (typeof window.GateAccessControlController.enforce === 'function') window.GateAccessControlController.enforce();
      return;
    }

    if (document.querySelector('script[data-gate-access-controller="true"]')) return;

    const script = document.createElement('script');
    script.src = '/js/gate-access-control-controller.js';
    script.defer = true;
    script.dataset.gateAccessController = 'true';
    script.dataset.owner = 'gate-access-control-controller';
    script.onerror = () => console.warn('GATE access controller failed to load.');
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadController, { once: true });
  } else {
    loadController();
  }

  window.addEventListener('load', loadController, { once: true });
})();
