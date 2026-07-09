// GATE Phase 6 lifecycle hook bus
// Narrow owner for shared lifecycle hooks only. Workflow controllers own rendering and records.
(function () {
  'use strict';

  const HOOK_GROUPS = [
    'afterRenderAll',
    'afterPageChange',
    'afterDataChanged',
    'afterModalOpen',
    'afterCloseout'
  ];

  function ensureHookRegistry() {
    if (!window.GateHooks) window.GateHooks = {};
    for (const name of HOOK_GROUPS) {
      if (!Array.isArray(window.GateHooks[name])) window.GateHooks[name] = [];
    }
  }

  function activePageId() {
    const activePage = document.querySelector('.page.active[id]');
    return activePage ? activePage.id.replace(/^page-/, '') : '';
  }

  function activeWeekGroup() {
    try { return typeof window.getActiveWG === 'function' ? window.getActiveWG() : ''; } catch (_) { return ''; }
  }

  function hookPayload(extra) {
    return Object.assign({
      allData: Array.isArray(window.allData) ? window.allData : [],
      activePage: activePageId(),
      role: window.currentRole || '',
      weekGroup: activeWeekGroup(),
      timestamp: Date.now()
    }, extra || {});
  }

  function runGateHooks(name, payload) {
    ensureHookRegistry();
    const hooks = window.GateHooks[name];
    if (!Array.isArray(hooks) || hooks.length === 0) return;

    const data = hookPayload(payload);
    [...hooks].forEach(hook => {
      try { hook(data); }
      catch (error) { console.warn(`GATE hook failed: ${name}`, error); }
    });
  }

  function registerGateHook(name, fn) {
    ensureHookRegistry();
    if (!Array.isArray(window.GateHooks[name]) || typeof fn !== 'function') return false;
    if (!window.GateHooks[name].includes(fn)) window.GateHooks[name].push(fn);
    return true;
  }

  function unregisterGateHook(name, fn) {
    ensureHookRegistry();
    if (!Array.isArray(window.GateHooks[name]) || typeof fn !== 'function') return false;
    const before = window.GateHooks[name].length;
    window.GateHooks[name] = window.GateHooks[name].filter(hook => hook !== fn);
    return window.GateHooks[name].length !== before;
  }

  function syncGlobalFunction(name, fn) {
    window[name] = fn;
    try { eval(`${name} = window.${name}`); } catch (_) {}
  }

  function wrapRenderAll() {
    const current = window.renderAll;
    if (typeof current !== 'function') return false;
    if (current.__gateHooksWrapped === true) return true;

    const wrapped = function gateHooksRenderAllWrapper(...args) {
      const result = current.apply(this, args);
      runGateHooks('afterRenderAll', { args, source: 'renderAll' });
      return result;
    };
    wrapped.__gateHooksWrapped = true;
    wrapped.__gateHooksOriginal = current;
    window.renderAll = wrapped;
    try { renderAll = wrapped; } catch (_) {}
    return true;
  }

  function wrapShowPage() {
    const current = window.showPage;
    if (typeof current !== 'function') return false;
    if (current.__gateHooksWrapped === true) return true;

    const wrapped = function gateHooksShowPageWrapper(page, ...args) {
      const result = current.call(this, page, ...args);
      runGateHooks('afterPageChange', { page, args, source: 'showPage' });
      return result;
    };
    wrapped.__gateHooksWrapped = true;
    wrapped.__gateHooksOriginal = current;
    window.showPage = wrapped;
    try { showPage = wrapped; } catch (_) {}
    return true;
  }

  function installWrappers() {
    wrapRenderAll();
    wrapShowPage();
  }

  function installCompatibilityStubs() {
    window.GateHooks.installWrappers = installWrappers;

    window.GateHooks.installActiveBusController = function gateHooksActiveBusHandoff() {
      if (window.GateStatusBoardController?.scheduleRender) {
        window.GateStatusBoardController.scheduleRender({ force: true });
        return true;
      }
      return false;
    };

    window.GateHooks.installArchiveSchemaController = function gateHooksArchiveHandoff() {
      if (window.GateArchiveController?.refresh) {
        window.GateArchiveController.refresh();
        return true;
      }
      return false;
    };
  }

  function install() {
    ensureHookRegistry();
    syncGlobalFunction('runGateHooks', runGateHooks);
    syncGlobalFunction('registerGateHook', registerGateHook);
    syncGlobalFunction('unregisterGateHook', unregisterGateHook);
    installCompatibilityStubs();
    installWrappers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  window.addEventListener('load', install, { once: true });

  let attempts = 0;
  const retry = window.setInterval(() => {
    attempts += 1;
    installWrappers();
    if (attempts >= 24 || (window.renderAll?.__gateHooksWrapped && window.showPage?.__gateHooksWrapped)) window.clearInterval(retry);
  }, 250);
})();
