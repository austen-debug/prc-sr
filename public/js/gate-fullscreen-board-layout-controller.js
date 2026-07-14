// GATE fullscreen Status Board layout controller
// Measures the fixed security banner and synchronizes one fullscreen layout state.
(function () {
  'use strict';

  let scheduled = false;
  let resizeObserver = null;

  function board() {
    return document.getElementById('page-board');
  }

  function banner() {
    return document.querySelector('.security-banner-fixed');
  }

  function isFullscreenBoard() {
    const page = board();
    if (!page || !page.classList.contains('active')) return false;
    if (document.body.classList.contains('fullscreen-board')) return true;
    return Boolean(document.fullscreenElement);
  }

  function measureBanner() {
    const element = banner();
    if (!element) return 28;
    const rect = element.getBoundingClientRect();
    const height = Math.ceil(rect.height || element.offsetHeight || 0);
    return Math.max(22, height || 28);
  }

  function closeResponsiveMenu() {
    document.body.classList.remove('gate-mobile-drawer-open');
    document.body.dataset.gateMobileMenuOpen = 'false';

    const sheet = document.getElementById('gate-mobile-nav-sheet');
    const menu = document.getElementById('main-nav-menu');
    const trigger = document.getElementById('mobile-menu-trigger');

    sheet?.classList.remove('gate-mobile-sheet-open');
    menu?.classList.remove('mobile-dropdown-active');
    sheet?.setAttribute('aria-hidden', 'true');
    menu?.setAttribute('aria-hidden', 'true');
    trigger?.setAttribute('aria-expanded', 'false');
  }

  function sync() {
    scheduled = false;
    const active = isFullscreenBoard();
    document.body.classList.toggle('gate-fullscreen-board-active', active);
    document.documentElement.style.setProperty('--gate-fullscreen-banner-px', `${measureBanner()}px`);
    if (active) closeResponsiveMenu();
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  function start() {
    if (window.__gateFullscreenBoardLayoutControllerInstalled) return;
    window.__gateFullscreenBoardLayoutControllerInstalled = true;

    const observedBanner = banner();
    if (observedBanner && typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(scheduleSync);
      resizeObserver.observe(observedBanner);
    }

    new MutationObserver(scheduleSync).observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: false
    });

    document.addEventListener('fullscreenchange', scheduleSync, true);
    window.addEventListener('resize', scheduleSync, true);
    window.addEventListener('orientationchange', scheduleSync, true);
    window.registerGateHook?.('afterPageChange', scheduleSync);
    window.registerGateHook?.('afterRenderAll', scheduleSync);

    window.GateFullscreenBoardLayout = Object.freeze({
      sync: scheduleSync,
      isActive: isFullscreenBoard
    });

    scheduleSync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', scheduleSync, { once: true });
})();
