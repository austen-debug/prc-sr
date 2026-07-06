// GATE Active Bus Controller
// Canonical owner for the Status Board active-bus card surface.
(function () {
  'use strict';

  let lastSignature = '';
  let renderQueued = false;
  let rendering = false;
  let renderAllWrapped = false;
  let observerReady = false;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getWeekGroup() {
    try {
      if (typeof window.getActiveWG === 'function') return window.getActiveWG();
      if (typeof window.getActiveWeekGroup === 'function') return window.getActiveWeekGroup();
    } catch (_) {}
    return '';
  }

  function getActiveBuses() {
    const records = Array.isArray(window.allData) ? window.allData : [];
    const weekGroup = getWeekGroup();

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
      n(bus.otw_count),
      n(bus.female_count),
      n(bus.nat_count),
      n(bus.space_force_count),
      bus.departed_at,
      bus.created_at,
      bus.week_group
    ].join('|');
  }

  function getSignature(buses) {
    return buses.map(busSignature).join('~') || 'none';
  }

  function containerLooksCanonical(container, buses, signature) {
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

    const buses = getActiveBuses();
    const signature = getSignature(buses);
    const force = Boolean(options.force);

    if (!force && signature === lastSignature && containerLooksCanonical(container, buses, signature)) return;

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

  function scheduleRender(options = {}) {
    if (renderQueued) return;
    renderQueued = true;
    window.requestAnimationFrame(() => {
      renderQueued = false;
      renderActiveBuses(options);
    });
  }

  function wrapRenderAll() {
    if (renderAllWrapped || typeof window.renderAll !== 'function') return false;

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
    renderAllWrapped = true;
    return true;
  }

  function observeActiveBusSurface() {
    if (observerReady || typeof MutationObserver === 'undefined') return;
    const container = document.getElementById('active-buses');
    if (!container) return;

    const observer = new MutationObserver(() => {
      if (rendering) return;
      scheduleRender();
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

  function install() {
    window.GateActiveBusController = Object.freeze({
      isCanonicalOwner: true,
      render: renderActiveBuses,
      scheduleRender,
      getActiveBuses
    });

    wrapRenderAll();
    observeActiveBusSurface();
    renderActiveBuses({ force: true });

    if (typeof window.registerGateHook === 'function') {
      window.registerGateHook('afterRenderAll', () => scheduleRender({ force: true }));
      window.registerGateHook('afterDataChanged', () => scheduleRender({ force: true }));
      window.registerGateHook('afterPageChange', () => scheduleRender());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  window.addEventListener('load', () => {
    wrapRenderAll();
    observeActiveBusSurface();
    scheduleRender({ force: true });
  }, { once: true });
})();
