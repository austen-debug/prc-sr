// Canonical GATE 3 route lifecycle.
(function () {
  'use strict';
  const routes = new Map();
  let active = 'board';
  function register(id, owner) { routes.set(id, owner); }
  function activate(id) {
    if (!routes.has(id)) return false;
    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === 'page-' + id));
    active = id;
    window.runGateHooks?.('afterPageChange', { route: id, owner: routes.get(id) });
    return true;
  }
  window.GateRouteLifecycle = Object.freeze({ register, activate, active: () => active, owner: id => routes.get(id) || '' });
})();
