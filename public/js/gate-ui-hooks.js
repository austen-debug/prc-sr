(function () {
  'use strict';

  const HOOK_GROUPS = [
    'afterRenderAll',
    'afterPageChange',
    'afterDataChanged',
    'afterModalOpen',
    'afterCloseout'
  ];

  if (!window.GateHooks) {
    window.GateHooks = HOOK_GROUPS.reduce((hooks, name) => {
      hooks[name] = [];
      return hooks;
    }, {});
  } else {
    for (const name of HOOK_GROUPS) {
      if (!Array.isArray(window.GateHooks[name])) window.GateHooks[name] = [];
    }
  }

  function getActivePageId() {
    const activePage = document.querySelector('.page.active[id]');
    return activePage ? activePage.id.replace(/^page-/, '') : '';
  }

  function getWeekGroup() {
    try {
      return typeof window.getActiveWG === 'function' ? window.getActiveWG() : '';
    } catch (error) {
      return '';
    }
  }

  function buildPayload(extra) {
    return Object.assign({
      allData: Array.isArray(window.allData) ? window.allData : [],
      activePage: getActivePageId(),
      role: window.currentRole || '',
      weekGroup: getWeekGroup(),
      timestamp: Date.now()
    }, extra || {});
  }

  window.runGateHooks = function runGateHooks(name, payload) {
    const hooks = window.GateHooks?.[name];
    if (!Array.isArray(hooks) || hooks.length === 0) return;

    const hookPayload = buildPayload(payload);

    for (const hook of [...hooks]) {
      try {
        hook(hookPayload);
      } catch (error) {
        console.warn(`GATE hook failed: ${name}`, error);
      }
    }
  };

  window.registerGateHook = function registerGateHook(name, fn) {
    if (!Array.isArray(window.GateHooks?.[name]) || typeof fn !== 'function') return false;
    if (!window.GateHooks[name].includes(fn)) window.GateHooks[name].push(fn);
    return true;
  };

  window.unregisterGateHook = function unregisterGateHook(name, fn) {
    if (!Array.isArray(window.GateHooks?.[name]) || typeof fn !== 'function') return false;
    const before = window.GateHooks[name].length;
    window.GateHooks[name] = window.GateHooks[name].filter(hook => hook !== fn);
    return window.GateHooks[name].length !== before;
  };

  function wrapRenderAll() {
    const current = window.renderAll;
    if (typeof current !== 'function') return false;
    if (current.__gateHooksWrapped === true) return true;

    const wrapped = function gateHooksRenderAllWrapper(...args) {
      const result = current.apply(this, args);
      window.runGateHooks('afterRenderAll', { args });
      return result;
    };

    wrapped.__gateHooksWrapped = true;
    wrapped.__gateHooksOriginal = current;
    window.renderAll = wrapped;
    return true;
  }

  function wrapShowPage() {
    const current = window.showPage;
    if (typeof current !== 'function') return false;
    if (current.__gateHooksWrapped === true) return true;

    const wrapped = function gateHooksShowPageWrapper(page, ...args) {
      const result = current.call(this, page, ...args);
      window.runGateHooks('afterPageChange', { page, args });
      return result;
    };

    wrapped.__gateHooksWrapped = true;
    wrapped.__gateHooksOriginal = current;
    window.showPage = wrapped;
    return true;
  }

  function installWrappers() {
    wrapRenderAll();
    wrapShowPage();
  }

  window.GateHooks.installWrappers = installWrappers;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWrappers, { once: true });
  } else {
    installWrappers();
  }

  window.addEventListener('load', installWrappers, { once: true });

  let attempts = 0;
  const retry = window.setInterval(() => {
    attempts += 1;
    installWrappers();
    if (attempts >= 12) window.clearInterval(retry);
  }, 250);
})();
