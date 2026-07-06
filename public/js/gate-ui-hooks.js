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

  function installActiveBusController() {
    if (window.GateActiveBusController) return;

    let lastSignature = '';
    let renderQueued = false;
    let rendering = false;
    let activeBusRenderAllWrapped = false;
    let observerReady = false;

    function numberValue(value) {
      const parsed = Number(value || 0);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function activeWeekGroup() {
      try {
        if (typeof window.getActiveWG === 'function') return window.getActiveWG();
      } catch (_) {}
      return '';
    }

    function activeBuses() {
      const records = Array.isArray(window.allData) ? window.allData : [];
      const weekGroup = activeWeekGroup();
      return records
        .filter(record => record && record.type === 'bus' && record.status === 'active')
        .filter(record => !weekGroup || record.week_group === weekGroup)
        .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    }

    function busSignature(bus) {
      return [
        bus.__backendId,
        bus.bus_type,
        bus.bus_id,
        bus.destination,
        bus.originating_destination,
        bus.status,
        numberValue(bus.otw_count),
        numberValue(bus.female_count),
        numberValue(bus.nat_count),
        numberValue(bus.space_force_count),
        bus.departed_at,
        bus.created_at,
        bus.week_group
      ].join('|');
    }

    function signatureFor(buses) {
      return buses.map(busSignature).join('~') || 'none';
    }

    function looksCanonical(container, buses, signature) {
      if (!container || container.dataset.gateActiveBusSignature !== signature) return false;

      if (buses.length === 0) {
        return Boolean(container.querySelector('[data-owner="gate-active-bus-controller"][data-empty-state="true"]'));
      }

      const cards = Array.from(container.querySelectorAll('[data-component="active-bus-card"]'));
      if (cards.length !== buses.length) return false;

      return cards.every(card => (
        card.dataset.owner === 'gate-active-bus-controller' &&
        card.querySelector('.prc-bus-card-title') &&
        card.querySelector('.prc-bus-card-line') &&
        card.querySelector('.prc-bus-card-dept')
      ));
    }

    function renderActiveBuses(options = {}) {
      const container = document.getElementById('active-buses');
      if (!container || rendering) return;

      const buses = activeBuses();
      const signature = signatureFor(buses);
      const force = Boolean(options.force);

      if (!force && signature === lastSignature && looksCanonical(container, buses, signature)) return;

      rendering = true;
      try {
        const components = window.GateComponents;
        container.dataset.component = 'active-bus-surface';
        container.dataset.owner = 'gate-active-bus-controller';
        container.dataset.gateActiveBusSignature = signature;

        if (buses.length === 0) {
          container.innerHTML = '<span class="text-muted text-sm" data-owner="gate-active-bus-controller" data-empty-state="true">None</span>';
        } else if (components?.activeBusCard) {
          container.innerHTML = buses.map(bus => components.activeBusCard(bus)).join('');
        }

        lastSignature = signature;
      } finally {
        rendering = false;
      }
    }

    function scheduleActiveBusRender(options = {}) {
      if (renderQueued) return;
      renderQueued = true;
      window.requestAnimationFrame(() => {
        renderQueued = false;
        renderActiveBuses(options);
      });
    }

    function wrapActiveBusRenderAll() {
      if (activeBusRenderAllWrapped || typeof window.renderAll !== 'function') return false;

      const originalRenderAll = window.renderAll;
      const wrappedRenderAll = function gateActiveBusRenderAllWrapper(...args) {
        const result = originalRenderAll.apply(this, args);
        renderActiveBuses({ force: true });
        return result;
      };

      wrappedRenderAll.__gateActiveBusWrapped = true;
      wrappedRenderAll.__gateActiveBusOriginal = originalRenderAll;
      window.renderAll = wrappedRenderAll;
      try { renderAll = wrappedRenderAll; } catch (_) {}
      activeBusRenderAllWrapped = true;
      return true;
    }

    function observeActiveBusSurface() {
      if (observerReady || typeof MutationObserver === 'undefined') return;
      const container = document.getElementById('active-buses');
      if (!container) return;

      const observer = new MutationObserver(() => {
        if (rendering) return;
        scheduleActiveBusRender();
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'title', 'aria-label', 'data-component', 'data-owner']
      });

      observerReady = true;
    }

    window.GateActiveBusController = Object.freeze({
      isCanonicalOwner: true,
      render: renderActiveBuses,
      scheduleRender: scheduleActiveBusRender,
      getActiveBuses: activeBuses
    });

    wrapActiveBusRenderAll();
    observeActiveBusSurface();
    renderActiveBuses({ force: true });

    window.registerGateHook('afterRenderAll', () => scheduleActiveBusRender({ force: true }));
    window.registerGateHook('afterDataChanged', () => scheduleActiveBusRender({ force: true }));
    window.registerGateHook('afterPageChange', () => scheduleActiveBusRender());
  }

  window.GateHooks.installWrappers = installWrappers;
  window.GateHooks.installActiveBusController = installActiveBusController;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      installWrappers();
      installActiveBusController();
    }, { once: true });
  } else {
    installWrappers();
    installActiveBusController();
  }

  window.addEventListener('load', () => {
    installWrappers();
    installActiveBusController();
  }, { once: true });

  let attempts = 0;
  const retry = window.setInterval(() => {
    attempts += 1;
    installWrappers();
    if (attempts >= 12) window.clearInterval(retry);
  }, 250);
})();
