// GATE mobile navigation routing fix
// Ensures each mobile menu tap routes to the tapped button's data-page instead of a stale/overlapping handler.
(function () {
  'use strict';

  let installed = false;
  let scheduled = false;
  let suppressClickUntil = 0;

  function isMobileNavViewport() {
    return window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 900px)').matches;
  }

  function installStyles() {
    if (document.getElementById('gate-mobile-nav-routing-fix')) return;

    const style = document.createElement('style');
    style.id = 'gate-mobile-nav-routing-fix';
    style.textContent = `
      @media (max-width: 767px), (pointer: coarse) and (max-width: 900px) {
        #main-nav-menu.mobile-dropdown-active,
        #nav-links.mobile-dropdown-active,
        .nav-group-left.mobile-dropdown-active {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          grid-auto-flow: row !important;
          grid-auto-rows: minmax(46px, auto) !important;
          align-items: stretch !important;
          justify-items: stretch !important;
          pointer-events: auto !important;
        }

        #main-nav-menu .nav-btn,
        #nav-links .nav-btn,
        .nav-group-left .nav-btn,
        #main-nav-menu .gate-component-nav-button,
        #nav-links .gate-component-nav-button,
        .nav-group-left .gate-component-nav-button {
          position: relative !important;
          inset: auto !important;
          top: auto !important;
          right: auto !important;
          bottom: auto !important;
          left: auto !important;
          z-index: auto !important;
          display: flex !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: 46px !important;
          min-height: 46px !important;
          max-height: none !important;
          transform: none !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          touch-action: manipulation !important;
          grid-column: 1 / -1 !important;
          grid-row: auto !important;
        }

        #main-nav-menu .nav-btn::before,
        #main-nav-menu .nav-btn::after,
        #nav-links .nav-btn::before,
        #nav-links .nav-btn::after,
        .nav-group-left .nav-btn::before,
        .nav-group-left .nav-btn::after {
          pointer-events: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function navMenu() {
    return document.getElementById('main-nav-menu') || document.getElementById('nav-links') || document.querySelector('.nav-group-left');
  }

  function closeMobileMenu() {
    const menu = navMenu();
    const trigger = document.getElementById('mobile-menu-trigger');
    if (menu) menu.classList.remove('mobile-dropdown-active');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function setActiveNav(page) {
    document.querySelectorAll('#main-nav-menu .nav-btn, #nav-links .nav-btn, .nav-group-left .nav-btn').forEach(button => {
      const active = button.dataset?.page === page;
      button.classList.toggle('active', active);
      button.classList.toggle('active-page-state', active);
      button.classList.toggle('current-page', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  function routeToPage(page) {
    if (!page) return;
    try {
      if (typeof showPage === 'function') showPage(page);
      else if (typeof window.showPage === 'function') window.showPage(page);
    } catch (error) {
      console.warn('GATE mobile nav route failed:', error);
      return;
    }
    setActiveNav(page);
    closeMobileMenu();
    try { window.runGateHooks?.('afterPageChange', { source: 'mobile-nav-routing-fix', page }); } catch (_) {}
  }

  function pageFromTarget(target) {
    const menu = navMenu();
    if (!menu || !target?.closest) return '';
    const button = target.closest('#main-nav-menu .nav-btn[data-page], #nav-links .nav-btn[data-page], .nav-group-left .nav-btn[data-page], #main-nav-menu [data-component="nav-button"][data-page], #nav-links [data-component="nav-button"][data-page], .nav-group-left [data-component="nav-button"][data-page]');
    if (!button || !menu.contains(button)) return '';
    return String(button.dataset.page || '').trim();
  }

  function handleNavActivation(event, source) {
    if (!isMobileNavViewport()) return;

    const page = pageFromTarget(event.target);
    if (!page) return;

    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();

    if (source === 'touchend') suppressClickUntil = Date.now() + 650;
    if (source === 'click' && Date.now() < suppressClickUntil) return;

    routeToPage(page);
  }

  function hardenNavButtons() {
    installStyles();
    const menu = navMenu();
    if (!menu) return;

    menu.querySelectorAll('.nav-btn[data-page], [data-component="nav-button"][data-page]').forEach(button => {
      button.type = 'button';
      button.dataset.gateMobileRoute = button.dataset.page || '';
      button.setAttribute('role', 'button');
      button.style.setProperty('position', 'relative', 'important');
      button.style.setProperty('width', '100%', 'important');
      button.style.setProperty('grid-column', '1 / -1', 'important');
      button.style.setProperty('transform', 'none', 'important');
      button.style.setProperty('pointer-events', 'auto', 'important');
    });
  }

  function runPass() {
    scheduled = false;
    hardenNavButtons();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(runPass);
  }

  function start() {
    if (installed) return;
    installed = true;
    installStyles();
    hardenNavButtons();
    document.addEventListener('touchend', event => handleNavActivation(event, 'touchend'), true);
    document.addEventListener('click', event => handleNavActivation(event, 'click'), true);
    window.addEventListener('resize', schedule, true);
    window.addEventListener('orientationchange', schedule, true);
    window.registerGateHook?.('afterPageChange', schedule);
    window.registerGateHook?.('afterRenderAll', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-page', 'onclick'] });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
