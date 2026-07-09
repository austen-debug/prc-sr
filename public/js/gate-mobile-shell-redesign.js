// GATE mobile shell redesign
// Replaces compressed desktop header behavior with a scalable phone-first shell.
(function () {
  'use strict';

  let installed = false;
  let scheduled = false;
  let placeholder = null;

  const TOOL_IDS = ['sound-toggle-btn', 'fullscreen-btn', 'role-toggle'];

  function isMobileShell() {
    return window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 900px)').matches;
  }

  function nav() {
    return document.querySelector('.app-nav, .command-header-bar');
  }

  function menu() {
    return document.getElementById('main-nav-menu') || document.getElementById('nav-links') || document.querySelector('.nav-group-left');
  }

  function rightGroup() {
    const shell = nav();
    return shell?.querySelector('.nav-group-right') || shell?.querySelector(':scope > div:last-child') || null;
  }

  function themeButton() {
    return document.querySelector('.app-nav button[aria-label*="theme" i], .command-header-bar button[aria-label*="theme" i], button[aria-label="Toggle theme"]');
  }

  function toolElements() {
    const items = [];
    const theme = themeButton();
    if (theme) items.push(theme);
    TOOL_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el && !items.includes(el)) items.push(el);
    });
    return items.filter(Boolean);
  }

  function ensurePlaceholder() {
    const group = rightGroup();
    if (!group) return null;
    if (placeholder && placeholder.isConnected) return placeholder;
    placeholder = document.createComment('gate-mobile-shell-tools-anchor');
    group.appendChild(placeholder);
    return placeholder;
  }

  function ensureMenuPanel() {
    const m = menu();
    if (!m) return null;

    let panel = document.getElementById('gate-mobile-system-menu-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'gate-mobile-system-menu-panel';
      panel.className = 'gate-mobile-system-menu-panel';
      panel.setAttribute('aria-label', 'System controls');
      panel.innerHTML = '<div class="gate-mobile-menu-section-label">System</div><div id="gate-mobile-system-controls" class="gate-mobile-system-controls"></div>';
    }

    if (!m.contains(panel)) m.appendChild(panel);
    return panel.querySelector('#gate-mobile-system-controls');
  }

  function moveToolsIntoMenu() {
    ensurePlaceholder();
    const target = ensureMenuPanel();
    if (!target) return;

    toolElements().forEach(button => {
      button.dataset.gateMobileTool = 'true';
      button.type = 'button';
      target.appendChild(button);
    });
  }

  function restoreToolsToHeader() {
    const group = rightGroup();
    if (!group) return;
    const anchor = ensurePlaceholder();
    toolElements().forEach(button => {
      if (anchor && anchor.parentNode === group) group.insertBefore(button, anchor);
      else group.appendChild(button);
      button.dataset.gateMobileTool = 'false';
    });
  }

  function installStyles() {
    if (document.getElementById('gate-mobile-shell-redesign')) return;

    const style = document.createElement('style');
    style.id = 'gate-mobile-shell-redesign';
    style.textContent = `
      @media (max-width: 767px), (pointer: coarse) and (max-width: 900px) {
        :root {
          --gate-phone-banner-h: 28px;
          --gate-phone-shell-h: 62px;
          --gate-phone-shell-top: var(--gate-phone-banner-h);
          --gate-phone-page-top: calc(var(--gate-phone-banner-h) + var(--gate-phone-shell-h) + 12px);
          --gate-phone-safe-x: max(12px, env(safe-area-inset-left), env(safe-area-inset-right));
          --gate-phone-control-h: clamp(42px, 10vw, 48px);
          --gate-phone-font-xs: clamp(0.66rem, 2.6vw, 0.76rem);
          --gate-phone-font-sm: clamp(0.76rem, 3vw, 0.88rem);
          --gate-phone-font-md: clamp(0.88rem, 3.6vw, 1rem);
        }

        html,
        body {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
        }

        .security-banner-fixed {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          height: var(--gate-phone-banner-h) !important;
          min-height: var(--gate-phone-banner-h) !important;
          max-height: var(--gate-phone-banner-h) !important;
          padding: 0 var(--gate-phone-safe-x) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: clamp(0.62rem, 2.4vw, 0.72rem) !important;
          line-height: 1 !important;
          letter-spacing: 0.12em !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          z-index: 10050 !important;
        }

        .app-nav,
        .app-nav.command-header-bar,
        .command-header-bar {
          position: fixed !important;
          top: var(--gate-phone-shell-top) !important;
          left: 0 !important;
          right: 0 !important;
          height: var(--gate-phone-shell-h) !important;
          min-height: var(--gate-phone-shell-h) !important;
          max-height: var(--gate-phone-shell-h) !important;
          padding: 8px var(--gate-phone-safe-x) !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          grid-template-rows: 1fr !important;
          grid-template-areas: 'week menu' !important;
          gap: 10px !important;
          align-items: center !important;
          overflow: visible !important;
          z-index: 10040 !important;
        }

        .app-nav::before,
        .app-nav.command-header-bar::before,
        .command-header-bar::before {
          display: none !important;
          content: none !important;
          background: none !important;
        }

        .app-nav > div:last-child,
        .app-nav .nav-group-right,
        .command-header-bar .nav-group-right {
          display: contents !important;
          width: auto !important;
          min-width: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          overflow: visible !important;
        }

        #week-group-display {
          grid-area: week !important;
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          height: var(--gate-phone-control-h) !important;
          min-height: var(--gate-phone-control-h) !important;
          padding: 0 0.78rem !important;
          overflow: hidden !important;
          white-space: nowrap !important;
          text-overflow: ellipsis !important;
          font-size: var(--gate-phone-font-sm) !important;
          letter-spacing: 0.055em !important;
          border-radius: 16px !important;
        }

        #mobile-menu-trigger,
        #mobile-menu-trigger.mobile-only-control {
          grid-area: menu !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: clamp(92px, 26vw, 116px) !important;
          min-width: clamp(92px, 26vw, 116px) !important;
          max-width: clamp(92px, 26vw, 116px) !important;
          height: var(--gate-phone-control-h) !important;
          min-height: var(--gate-phone-control-h) !important;
          padding: 0 0.74rem !important;
          font-size: var(--gate-phone-font-xs) !important;
          letter-spacing: 0.08em !important;
          border-radius: 16px !important;
          text-transform: uppercase !important;
          touch-action: manipulation !important;
        }

        #main-nav-menu,
        #nav-links,
        .nav-group-left {
          position: fixed !important;
          top: calc(var(--gate-phone-banner-h) + var(--gate-phone-shell-h) + 8px) !important;
          left: var(--gate-phone-safe-x) !important;
          right: var(--gate-phone-safe-x) !important;
          bottom: auto !important;
          z-index: 10060 !important;
          display: none !important;
          grid-template-columns: minmax(0, 1fr) !important;
          grid-auto-flow: row !important;
          grid-auto-rows: auto !important;
          gap: 8px !important;
          width: auto !important;
          max-width: none !important;
          max-height: calc(100dvh - var(--gate-phone-page-top) - 18px) !important;
          padding: 10px !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch !important;
          border-radius: 20px !important;
        }

        #main-nav-menu.mobile-dropdown-active,
        #nav-links.mobile-dropdown-active,
        .nav-group-left.mobile-dropdown-active {
          display: grid !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          transform: translateY(0) !important;
        }

        #main-nav-menu .nav-btn,
        #nav-links .nav-btn,
        .nav-group-left .nav-btn,
        #main-nav-menu .gate-component-nav-button,
        #nav-links .gate-component-nav-button,
        .nav-group-left .gate-component-nav-button {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: var(--gate-phone-control-h) !important;
          min-height: var(--gate-phone-control-h) !important;
          padding: 0 0.92rem !important;
          border-radius: 14px !important;
          font-size: var(--gate-phone-font-sm) !important;
          letter-spacing: 0.055em !important;
          text-align: left !important;
          grid-column: 1 / -1 !important;
          touch-action: manipulation !important;
        }

        .gate-mobile-system-menu-panel {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 8px !important;
          margin-top: 4px !important;
          padding-top: 10px !important;
          border-top: 1px solid rgba(184, 190, 199, 0.18) !important;
        }

        .gate-mobile-menu-section-label {
          padding: 0 0.28rem !important;
          color: var(--text-muted, #94a3b8) !important;
          font-size: clamp(0.58rem, 2.2vw, 0.68rem) !important;
          font-weight: 950 !important;
          letter-spacing: 0.14em !important;
          text-transform: uppercase !important;
        }

        .gate-mobile-system-controls {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 8px !important;
        }

        .gate-mobile-system-controls button,
        .gate-mobile-system-controls [role='button'] {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: var(--gate-phone-control-h) !important;
          min-height: var(--gate-phone-control-h) !important;
          padding: 0 0.92rem !important;
          border-radius: 14px !important;
          justify-content: flex-start !important;
          font-size: var(--gate-phone-font-sm) !important;
          letter-spacing: 0.055em !important;
          text-align: left !important;
          touch-action: manipulation !important;
        }

        body:not(.fullscreen-board) .page,
        body:not(.fullscreen-board) #page-board,
        body:not(.fullscreen-board) #page-airport,
        body:not(.fullscreen-board) #page-input,
        body:not(.fullscreen-board) #page-processing,
        body:not(.fullscreen-board) #page-archives,
        body:not(.fullscreen-board) #page-squadron.gate-squadron-page {
          width: 100% !important;
          max-width: 100vw !important;
          min-width: 0 !important;
          padding-top: var(--gate-phone-page-top) !important;
          padding-left: var(--gate-phone-safe-x) !important;
          padding-right: var(--gate-phone-safe-x) !important;
          overflow-x: hidden !important;
          box-sizing: border-box !important;
        }

        .surface,
        .tactical-glass-card,
        .gate-dorm-card,
        .dorm-card,
        .modal-content {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        input,
        select,
        textarea,
        button {
          font-size: max(16px, var(--gate-phone-font-sm)) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureMobileMenuButtonExists() {
    const shell = nav();
    const m = menu();
    if (!shell || !m || document.getElementById('mobile-menu-trigger')) return;

    const trigger = document.createElement('button');
    trigger.id = 'mobile-menu-trigger';
    trigger.type = 'button';
    trigger.className = 'tactical-nav-pill mobile-only-control gate-component-nav-button';
    trigger.dataset.component = 'mobile-nav-trigger';
    trigger.setAttribute('aria-label', 'Toggle Operational Navigation Menu');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', m.id || 'main-nav-menu');
    trigger.innerHTML = '<span>Menu</span><span class="menu-arrow-indicator" aria-hidden="true">▾</span>';
    shell.insertBefore(trigger, m);
  }

  function normalizeMobileShell() {
    installStyles();
    ensureMobileMenuButtonExists();

    if (isMobileShell()) {
      document.body.classList.add('gate-mobile-shell-redesigned');
      moveToolsIntoMenu();
    } else {
      document.body.classList.remove('gate-mobile-shell-redesigned');
      restoreToolsToHeader();
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      normalizeMobileShell();
    });
  }

  function start() {
    if (installed) return;
    installed = true;
    installStyles();
    normalizeMobileShell();
    window.addEventListener('resize', schedule, true);
    window.addEventListener('orientationchange', schedule, true);
    document.addEventListener('click', schedule, true);
    window.registerGateHook?.('afterPageChange', schedule);
    window.registerGateHook?.('afterRenderAll', schedule);
    window.registerGateHook?.('afterDataChanged', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-page', 'aria-expanded'] });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
