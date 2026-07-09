// GATE mobile app shell finalizer
// Final mobile presentation owner: page isolation, drawer behavior, and app-like spacing.
(function () {
  'use strict';

  const MOBILE_MEDIA = '(max-width: 767px), (pointer: coarse) and (max-width: 1024px) and (max-height: 560px)';
  let installed = false;
  let scheduled = false;
  let drawerOpen = false;
  let patchedShowPage = false;

  function isMobile() {
    return window.matchMedia(MOBILE_MEDIA).matches;
  }

  function pages() {
    return Array.from(document.querySelectorAll('.page[id^="page-"]'));
  }

  function activePageId() {
    const active = pages().find(page => page.classList.contains('active'));
    if (active) return active.id.replace(/^page-/, '');
    return 'board';
  }

  function menu() {
    return document.getElementById('main-nav-menu') || document.getElementById('nav-links') || document.querySelector('.nav-group-left');
  }

  function trigger() {
    return document.getElementById('mobile-menu-trigger');
  }

  function setDrawer(open) {
    drawerOpen = Boolean(open);
    const m = menu();
    const t = trigger();
    document.body.classList.toggle('gate-mobile-drawer-open', drawerOpen && isMobile());
    if (m) {
      m.classList.toggle('mobile-dropdown-active', drawerOpen && isMobile());
      m.setAttribute('aria-hidden', drawerOpen && isMobile() ? 'false' : 'true');
    }
    if (t) t.setAttribute('aria-expanded', drawerOpen && isMobile() ? 'true' : 'false');
  }

  function forcePageIsolation(pageName = activePageId()) {
    const mobile = isMobile();
    pages().forEach(page => {
      const pageId = page.id.replace(/^page-/, '');
      const isActive = pageId === pageName || page.classList.contains('active') && pageName === activePageId();
      page.classList.toggle('active', Boolean(isActive));
      page.classList.toggle('gate-mobile-active-page', Boolean(mobile && isActive));
      page.classList.toggle('gate-mobile-inactive-page', Boolean(mobile && !isActive));
      page.setAttribute('aria-hidden', mobile && !isActive ? 'true' : 'false');
      if (mobile) {
        page.style.setProperty('display', isActive ? 'block' : 'none', 'important');
        page.style.setProperty('visibility', isActive ? 'visible' : 'hidden', 'important');
        page.style.setProperty('pointer-events', isActive ? 'auto' : 'none', 'important');
        page.style.setProperty('position', isActive ? 'relative' : 'absolute', 'important');
        page.style.setProperty('inset', isActive ? 'auto' : '0', 'important');
        page.style.setProperty('z-index', isActive ? '1' : '-1', 'important');
      } else {
        page.style.removeProperty('display');
        page.style.removeProperty('visibility');
        page.style.removeProperty('pointer-events');
        page.style.removeProperty('position');
        page.style.removeProperty('inset');
        page.style.removeProperty('z-index');
      }
    });
  }

  function syncNavState(pageName = activePageId()) {
    document.querySelectorAll('#main-nav-menu [data-page], #nav-links [data-page], .nav-group-left [data-page]').forEach(button => {
      const active = button.dataset.page === pageName;
      button.classList.toggle('active', active);
      button.classList.toggle('active-page-state', active);
      button.classList.toggle('current-page', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  function cleanWeekGroup() {
    const wg = document.getElementById('week-group-display');
    if (!wg) return;
    const raw = String(wg.textContent || '').replace(/\s+/g, ' ').trim();
    wg.dataset.fullText = raw;
    wg.setAttribute('title', raw);
    wg.setAttribute('aria-label', `Active week group: ${raw || 'No week group'}`);
    if (isMobile()) {
      const cleaned = raw.replace(/^week\s*group\s*[:\-]?\s*/i, '').trim();
      wg.textContent = cleaned ? `WG ${cleaned.replace(/^WG\s*/i, '')}` : 'No WG';
    }
  }

  function installStyles() {
    if (document.getElementById('gate-mobile-app-shell-finalizer')) return;
    const style = document.createElement('style');
    style.id = 'gate-mobile-app-shell-finalizer';
    style.textContent = `
      @media ${MOBILE_MEDIA} {
        body.gate-mobile-shell-redesigned {
          width: 100% !important;
          max-width: 100vw !important;
          overflow-x: hidden !important;
          background-attachment: scroll !important;
        }

        body.gate-mobile-shell-redesigned .page.gate-mobile-inactive-page {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: -1 !important;
          overflow: hidden !important;
          height: 0 !important;
          min-height: 0 !important;
        }

        body.gate-mobile-shell-redesigned .page.gate-mobile-active-page {
          display: block !important;
          visibility: visible !important;
          pointer-events: auto !important;
          position: relative !important;
          z-index: 1 !important;
          min-height: 100dvh !important;
          overflow-x: hidden !important;
        }

        body.gate-mobile-shell-redesigned #week-group-display {
          display: flex !important;
          align-items: center !important;
          min-width: 0 !important;
          width: 100% !important;
          height: var(--gate-phone-control-h, 46px) !important;
          padding: 0 0.78rem !important;
          overflow: hidden !important;
          white-space: nowrap !important;
          text-overflow: ellipsis !important;
          font-weight: 950 !important;
          letter-spacing: 0.055em !important;
          text-transform: uppercase !important;
          line-height: 1 !important;
          box-sizing: border-box !important;
        }

        body.gate-mobile-shell-redesigned #mobile-menu-trigger {
          flex: none !important;
          box-sizing: border-box !important;
        }

        body.gate-mobile-shell-redesigned #main-nav-menu,
        body.gate-mobile-shell-redesigned #nav-links,
        body.gate-mobile-shell-redesigned .nav-group-left {
          box-sizing: border-box !important;
          left: var(--gate-phone-safe-x, 12px) !important;
          right: var(--gate-phone-safe-x, 12px) !important;
          width: auto !important;
          max-width: none !important;
          border: 1px solid rgba(184, 190, 199, 0.22) !important;
          box-shadow: 0 24px 52px rgba(0, 0, 0, 0.62) !important;
        }

        body.gate-mobile-shell-redesigned #main-nav-menu:not(.mobile-dropdown-active),
        body.gate-mobile-shell-redesigned #nav-links:not(.mobile-dropdown-active),
        body.gate-mobile-shell-redesigned .nav-group-left:not(.mobile-dropdown-active) {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        body.gate-mobile-shell-redesigned #main-nav-menu.mobile-dropdown-active,
        body.gate-mobile-shell-redesigned #nav-links.mobile-dropdown-active,
        body.gate-mobile-shell-redesigned .nav-group-left.mobile-dropdown-active {
          display: grid !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
        }

        body.gate-mobile-shell-redesigned #main-nav-menu button,
        body.gate-mobile-shell-redesigned #nav-links button,
        body.gate-mobile-shell-redesigned .nav-group-left button,
        body.gate-mobile-shell-redesigned .gate-mobile-system-controls button {
          min-width: 0 !important;
          width: 100% !important;
          justify-content: flex-start !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        body.gate-mobile-shell-redesigned .surface,
        body.gate-mobile-shell-redesigned .tactical-glass-card {
          overflow-wrap: anywhere !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function patchShowPage() {
    if (patchedShowPage) return;
    const original = window.showPage || (typeof showPage === 'function' ? showPage : null);
    if (typeof original !== 'function') return;

    const patched = function gateMobileFinalShowPage(page) {
      const result = original.apply(this, arguments);
      window.requestAnimationFrame(() => {
        forcePageIsolation(page || activePageId());
        syncNavState(page || activePageId());
        setDrawer(false);
        cleanWeekGroup();
      });
      return result;
    };

    window.showPage = patched;
    try { showPage = patched; } catch (_) {}
    patchedShowPage = true;
  }

  function routeFromMenu(event) {
    if (!isMobile()) return;
    const target = event.target?.closest?.('#main-nav-menu [data-page], #nav-links [data-page], .nav-group-left [data-page]');
    if (!target) return;
    const page = target.dataset.page;
    if (!page) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    if (typeof window.showPage === 'function') window.showPage(page);
    else forcePageIsolation(page);
    syncNavState(page);
    setDrawer(false);
  }

  function handleMenuTrigger(event) {
    if (!isMobile()) return;
    const t = event.target?.closest?.('#mobile-menu-trigger');
    if (!t) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    setDrawer(!drawerOpen);
  }

  function handleOutsideTap(event) {
    if (!isMobile() || !drawerOpen) return;
    const m = menu();
    const t = trigger();
    if (m?.contains(event.target) || t?.contains(event.target)) return;
    setDrawer(false);
  }

  function runPass() {
    scheduled = false;
    installStyles();
    patchShowPage();
    const active = activePageId();
    forcePageIsolation(active);
    syncNavState(active);
    cleanWeekGroup();
    if (!isMobile()) setDrawer(false);
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
    patchShowPage();
    document.addEventListener('click', handleMenuTrigger, true);
    document.addEventListener('touchend', handleMenuTrigger, true);
    document.addEventListener('click', routeFromMenu, true);
    document.addEventListener('touchend', routeFromMenu, true);
    document.addEventListener('click', handleOutsideTap, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setDrawer(false);
    }, true);
    window.addEventListener('resize', schedule, true);
    window.addEventListener('orientationchange', schedule, true);
    window.registerGateHook?.('afterPageChange', schedule);
    window.registerGateHook?.('afterRenderAll', schedule);
    window.registerGateHook?.('afterDataChanged', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-expanded'] });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
