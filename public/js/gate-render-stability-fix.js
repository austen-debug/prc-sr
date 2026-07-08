// GATE render stability fixes
// Stabilizes high-refresh board/processing visual layers without changing workflow data.
(function () {
  'use strict';

  let installed = false;
  let scheduled = false;

  function installStyles() {
    if (document.getElementById('gate-render-stability-fix')) return;

    const style = document.createElement('style');
    style.id = 'gate-render-stability-fix';
    style.textContent = `
      @media (min-width: 768px) {
        body:has(#page-board.active)::before,
        body:has(#page-processing.active)::before {
          display: none !important;
          content: none !important;
          opacity: 0 !important;
          background-image: none !important;
          mix-blend-mode: normal !important;
          filter: none !important;
        }

        body:has(#page-board.active) #page-board.active {
          position: relative !important;
          isolation: isolate !important;
          transform: translateZ(0) !important;
          backface-visibility: hidden !important;
          will-change: auto !important;
        }

        body:has(#page-board.active) #page-board.active::before {
          content: '' !important;
          display: block !important;
          position: fixed !important;
          inset: 0 !important;
          pointer-events: none !important;
          z-index: 0 !important;
          background-repeat: no-repeat !important;
          background-position: center 55% !important;
          background-size: min(44vw, 760px) auto !important;
          opacity: var(--gate-watermark-opacity-clean, 0.07) !important;
          transform: translateZ(0) !important;
          backface-visibility: hidden !important;
          will-change: auto !important;
          animation: none !important;
          transition: none !important;
          mix-blend-mode: normal !important;
          filter: grayscale(100%) !important;
        }

        body:not(.theme-light):has(#page-board.active) #page-board.active::before {
          background-image: url('/assets/gate_emblem_white.png') !important;
          opacity: 0.075 !important;
        }

        body.theme-light:has(#page-board.active) #page-board.active::before {
          background-image: url('/assets/gate_emblem_blue.png') !important;
          opacity: 0.045 !important;
        }

        body:has(#page-board.active) #page-board.active::after,
        body:has(#page-board.active) #page-board.active .board-header::before,
        body:has(#page-board.active) #page-board.active .board-header::after,
        body:has(#page-board.active) #page-board.active .dorm-dashboard::before,
        body:has(#page-board.active) #page-board.active .dorm-dashboard::after {
          display: none !important;
          content: none !important;
          opacity: 0 !important;
          background: none !important;
          animation: none !important;
          transition: none !important;
        }

        body:has(#page-board.active) #page-board.active .board-header,
        body:has(#page-board.active) #page-board.active .dorm-dashboard,
        body:has(#page-board.active) #page-board.active .dorm-column,
        body:has(#page-board.active) #page-board.active .dorm-col-content,
        body:has(#page-board.active) #page-board.active .gate-dorm-card,
        body:has(#page-board.active) #page-board.active .dorm-card {
          position: relative !important;
          z-index: 1 !important;
          animation: none !important;
          transition-property: border-color, background-color, color, opacity !important;
          transition-duration: 0s !important;
          backface-visibility: hidden !important;
        }

        body:has(#page-processing.active) #page-processing.active {
          isolation: isolate !important;
          transform: translateZ(0) !important;
          backface-visibility: hidden !important;
        }

        body:has(#page-processing.active) #page-processing.active > .flex-shrink-0,
        body:has(#page-processing.active) #page-processing.active .surface,
        body:has(#page-processing.active) #page-processing.active .proc-card,
        body:has(#page-processing.active) #page-processing.active #proc-dorm-grid,
        body:has(#page-processing.active) #page-processing.active [id*='loaded'],
        body:has(#page-processing.active) #page-processing.active [id*='arrived'] {
          transform: translateZ(0) !important;
          backface-visibility: hidden !important;
          animation: none !important;
          transition-property: border-color, background-color, color, box-shadow !important;
          transition-duration: 0s !important;
          will-change: auto !important;
        }

        body:has(#page-processing.active) #page-processing.active .proc-card:hover,
        body:has(#page-processing.active) #page-processing.active .proc-card:focus,
        body:has(#page-processing.active) #page-processing.active .proc-card:focus-visible {
          transform: translateZ(0) !important;
          animation: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function markActivePage() {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
      const isVisible = !page.classList.contains('hidden') && page.offsetParent !== null;
      page.classList.toggle('active', isVisible);
    });
  }

  function run() {
    scheduled = false;
    installStyles();
    markActivePage();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  function start() {
    if (installed) return;
    installed = true;
    installStyles();
    markActivePage();
    window.addEventListener('resize', schedule, true);
    document.addEventListener('mousemove', schedule, { capture: true, passive: true });
    document.addEventListener('click', schedule, true);
    window.registerGateHook?.('afterPageChange', schedule);
    window.registerGateHook?.('afterRenderAll', schedule);
    window.registerGateHook?.('afterDataChanged', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
