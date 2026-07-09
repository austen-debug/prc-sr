// GATE desktop navigation restore
// Prevents mobile shell controllers from altering desktop/fine-pointer navigation.
(function () {
  'use strict';

  let installed = false;
  let scheduled = false;

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
      @media (hover: hover) and (pointer: fine) {
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
