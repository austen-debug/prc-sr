// GATE desktop navigation restore
// Prevents mobile shell controllers from altering desktop/fine-pointer navigation.
(function () {
  'use strict';

  let installed = false;
  let scheduled = false;

  const WIDE_DESKTOP_MEDIA = '(hover: hover) and (pointer: fine) and (min-width: 1280px)';
  const COMPACT_DESKTOP_MEDIA = '(hover: hover) and (pointer: fine) and (min-width: 768px) and (max-width: 1279px)';

  function isDesktopPointer() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function nav() {
    return document.querySelector('.app-nav, .command-header-bar');
  }

  function navRightGroup() {
    const shell = nav();
    if (!shell) return null;
    return shell.querySelector('.nav-group-right') || shell.querySelector(':scope > div:last-child') || shell;
  }

  function restoreToolButtons() {
    const target = navRightGroup();
    if (!target) return;

    const selectors = [
      '.app-nav button[aria-label*="theme" i]',
      '.command-header-bar button[aria-label*="theme" i]',
      'button[aria-label="Toggle theme"]',
      '#sound-toggle-btn',
      '#fullscreen-btn',
      '#role-toggle'
    ];

    const buttons = [];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(button => {
        if (button && !buttons.includes(button)) buttons.push(button);
      });
    });

    buttons.forEach(button => {
      if (button.id === 'mobile-menu-trigger') return;
      button.dataset.gateMobileTool = 'false';
      target.appendChild(button);
    });
  }

  function removeMobileTrigger() {
    document.querySelectorAll('#mobile-menu-trigger').forEach(button => button.remove());
  }

  function restorePages() {
    document.querySelectorAll('.page[id^="page-"]').forEach(page => {
      page.classList.remove('gate-mobile-active-page', 'gate-mobile-inactive-page');
      page.removeAttribute('aria-hidden');
      ['display', 'visibility', 'pointer-events', 'position', 'inset', 'z-index', 'height', 'min-height'].forEach(prop => {
        page.style.removeProperty(prop);
      });
    });
  }

  function restoreMenu() {
    const menu = document.getElementById('main-nav-menu') || document.getElementById('nav-links') || document.querySelector('.nav-group-left');
    if (!menu) return;
    menu.classList.remove('mobile-dropdown-active');
    menu.removeAttribute('aria-hidden');
    ['display', 'opacity', 'visibility', 'pointer-events', 'position', 'left', 'right', 'top', 'bottom', 'width', 'max-width', 'max-height', 'overflow-x', 'overflow-y', 'transform', 'z-index'].forEach(prop => {
      menu.style.removeProperty(prop);
    });
  }

  function installStyles() {
    if (document.getElementById('gate-desktop-nav-restore')) return;
    const style = document.createElement('style');
    style.id = 'gate-desktop-nav-restore';
    style.textContent = `
      @media ${WIDE_DESKTOP_MEDIA} {
        body.gate-mobile-shell-redesigned,
        body.gate-mobile-shell-landscape,
        body.gate-mobile-drawer-open {
          overflow-x: initial !important;
        }

        #mobile-menu-trigger {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        .app-nav,
        .app-nav.command-header-bar,
        .command-header-bar {
          display: flex !important;
          grid-template-columns: none !important;
          grid-template-areas: none !important;
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }

        .app-nav > div:last-child,
        .app-nav .nav-group-right,
        .command-header-bar .nav-group-right {
          display: flex !important;
          width: auto !important;
          min-width: 0 !important;
          overflow: visible !important;
        }

        #main-nav-menu,
        #nav-links,
        .nav-group-left {
          position: static !important;
          display: flex !important;
          width: auto !important;
          max-width: none !important;
          max-height: none !important;
          overflow: visible !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          transform: none !important;
          box-shadow: none !important;
        }

        #main-nav-menu .nav-btn,
        #nav-links .nav-btn,
        .nav-group-left .nav-btn,
        #main-nav-menu .gate-component-nav-button,
        #nav-links .gate-component-nav-button,
        .nav-group-left .gate-component-nav-button {
          width: auto !important;
          max-width: none !important;
          height: auto !important;
          min-height: 0 !important;
          grid-column: auto !important;
          text-align: center !important;
          justify-content: center !important;
        }

        .page.gate-mobile-inactive-page,
        .page.gate-mobile-active-page {
          visibility: visible !important;
          pointer-events: auto !important;
          position: relative !important;
          z-index: auto !important;
          height: auto !important;
          min-height: initial !important;
        }
      }

      @media ${COMPACT_DESKTOP_MEDIA} {
        #mobile-menu-trigger {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        body.gate-app-shell-ready .app-nav.command-header-bar,
        body.gate-app-shell-ready .app-nav,
        body.gate-app-shell-ready .command-header-bar,
        .app-nav,
        .app-nav.command-header-bar,
        .command-header-bar {
          --gate-header-brand-width: clamp(92px, 10vw, 128px);
          display: grid !important;
          grid-template-columns: var(--gate-header-brand-width) minmax(0, 1fr) max-content !important;
          grid-template-areas: 'brand nav tools' !important;
          grid-template-rows: 64px !important;
          align-items: center !important;
          gap: 0.4rem !important;
          width: 100% !important;
          height: 64px !important;
          min-height: 64px !important;
          max-height: 64px !important;
          padding: 0.42rem 0.55rem !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }

        body.gate-app-shell-ready .app-nav.command-header-bar::before,
        body.gate-app-shell-ready .app-nav::before,
        body.gate-app-shell-ready .command-header-bar::before,
        .app-nav::before,
        .app-nav.command-header-bar::before,
        .command-header-bar::before {
          grid-area: brand !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: var(--gate-header-brand-width) !important;
          height: 38px !important;
          min-height: 38px !important;
          align-self: center !important;
        }

        body.gate-app-shell-ready .app-nav.command-header-bar #main-nav-menu,
        body.gate-app-shell-ready .app-nav.command-header-bar #nav-links,
        body.gate-app-shell-ready .app-nav.command-header-bar .nav-group-left,
        #main-nav-menu,
        #nav-links,
        .nav-group-left {
          grid-area: nav !important;
          position: static !important;
          display: flex !important;
          flex: 1 1 auto !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 0.28rem !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          max-height: 38px !important;
          padding: 0.05rem !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          overscroll-behavior-x: contain !important;
          scrollbar-width: none !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          transform: none !important;
          box-shadow: none !important;
          white-space: nowrap !important;
        }

        #main-nav-menu::-webkit-scrollbar,
        #nav-links::-webkit-scrollbar,
        .nav-group-left::-webkit-scrollbar {
          display: none !important;
        }

        body.gate-app-shell-ready .app-nav.command-header-bar #main-nav-menu .nav-btn,
        body.gate-app-shell-ready .app-nav.command-header-bar #nav-links .nav-btn,
        body.gate-app-shell-ready .app-nav.command-header-bar .nav-group-left .nav-btn,
        #main-nav-menu .nav-btn,
        #nav-links .nav-btn,
        .nav-group-left .nav-btn,
        #main-nav-menu .gate-component-nav-button,
        #nav-links .gate-component-nav-button,
        .nav-group-left .gate-component-nav-button {
          flex: 0 0 auto !important;
          width: auto !important;
          max-width: none !important;
          height: 34px !important;
          min-height: 34px !important;
          max-height: 34px !important;
          padding: 0 0.5rem !important;
          font-size: 0.56rem !important;
          letter-spacing: 0.032em !important;
          line-height: 1 !important;
          white-space: nowrap !important;
          text-align: center !important;
          justify-content: center !important;
          grid-column: auto !important;
        }

        body.gate-app-shell-ready .app-nav.command-header-bar > div:last-child,
        body.gate-app-shell-ready .app-nav.command-header-bar .nav-group-right,
        body.gate-app-shell-ready .app-nav .nav-group-right,
        body.gate-app-shell-ready .command-header-bar .nav-group-right,
        .app-nav > div:last-child,
        .app-nav .nav-group-right,
        .command-header-bar .nav-group-right {
          grid-area: tools !important;
          display: flex !important;
          flex: 0 0 auto !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 0.25rem !important;
          width: auto !important;
          min-width: 0 !important;
          max-width: none !important;
          height: 38px !important;
          padding: 0 0 0 0.32rem !important;
          margin: 0 !important;
          overflow: hidden !important;
          border-left: 1px solid rgba(184, 190, 199, 0.18) !important;
          white-space: nowrap !important;
        }

        body.gate-app-shell-ready .app-nav.command-header-bar .nav-group-right .nav-btn,
        body.gate-app-shell-ready .app-nav.command-header-bar .nav-group-right button,
        .app-nav .nav-group-right .nav-btn,
        .app-nav .nav-group-right button,
        .command-header-bar .nav-group-right .nav-btn,
        .command-header-bar .nav-group-right button,
        #week-group-display,
        #role-toggle,
        #fullscreen-btn,
        #sound-toggle-btn,
        .app-nav button[aria-label='Toggle theme'] {
          flex: 0 0 auto !important;
          height: 34px !important;
          min-height: 34px !important;
          max-height: 34px !important;
          padding: 0 0.48rem !important;
          font-size: 0.54rem !important;
          letter-spacing: 0.028em !important;
          line-height: 1 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        #week-group-display {
          max-width: 78px !important;
        }

        #role-toggle {
          max-width: 120px !important;
        }

        #fullscreen-btn,
        #sound-toggle-btn {
          max-width: 90px !important;
        }

        .app-nav button[aria-label='Toggle theme'] {
          width: 34px !important;
          min-width: 34px !important;
          max-width: 34px !important;
          padding: 0 !important;
        }

        body:not(.fullscreen-board) .page,
        body:not(.fullscreen-board) #page-squadron.gate-squadron-page {
          padding-top: 108px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function restoreDesktopNav() {
    scheduled = false;
    installStyles();
    if (!isDesktopPointer()) return;

    document.body.classList.remove('gate-mobile-shell-redesigned', 'gate-mobile-shell-landscape', 'gate-mobile-drawer-open');
    removeMobileTrigger();
    restoreToolButtons();
    restoreMenu();
    restorePages();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(restoreDesktopNav);
  }

  function start() {
    if (installed) return;
    installed = true;
    installStyles();
    restoreDesktopNav();
    window.addEventListener('resize', schedule, true);
    window.addEventListener('orientationchange', schedule, true);
    document.addEventListener('click', schedule, true);
    window.registerGateHook?.('afterPageChange', schedule);
    window.registerGateHook?.('afterRenderAll', schedule);
    window.registerGateHook?.('afterDataChanged', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();