// GATE Phase 7F render stability style guard
// Processing and Squadron presentation only. The Status Board now owns stable,
// non-composited surfaces through its canonical CSS contract.
(function () {
  'use strict';

  let installed = false;

  function installStyles() {
    if (document.getElementById('gate-render-stability-fix')) return;

    const style = document.createElement('style');
    style.id = 'gate-render-stability-fix';
    style.dataset.owner = 'gate-render-stability-style-guard';
    style.textContent = `
      @media (min-width: 768px) {
        body:has(#page-processing.active)::before,
        body:has(#page-squadron.active)::before {
          display: none !important;
          content: none !important;
          opacity: 0 !important;
          background-image: none !important;
          mix-blend-mode: normal !important;
          filter: none !important;
        }

        body:has(#page-processing.active) #page-processing.active,
        body:has(#page-squadron.active) #page-squadron.active {
          position: relative !important;
          isolation: isolate !important;
          transform: translateZ(0) !important;
          backface-visibility: hidden !important;
          will-change: auto !important;
        }

        body:has(#page-processing.active) #page-processing.active::after,
        body:has(#page-squadron.active) #page-squadron.active::after,
        body:has(#page-squadron.active) #page-squadron.active .board-header::before,
        body:has(#page-squadron.active) #page-squadron.active .board-header::after,
        body:has(#page-squadron.active) #page-squadron.active .dorm-dashboard::before,
        body:has(#page-squadron.active) #page-squadron.active .dorm-dashboard::after {
          display: none !important;
          content: none !important;
          opacity: 0 !important;
          background: none !important;
          animation: none !important;
          transition: none !important;
        }

        body:has(#page-squadron.active) #page-squadron.active .board-header,
        body:has(#page-squadron.active) #page-squadron.active .dorm-dashboard,
        body:has(#page-squadron.active) #page-squadron.active .dorm-column,
        body:has(#page-squadron.active) #page-squadron.active .dorm-col-content,
        body:has(#page-squadron.active) #page-squadron.active .gate-dorm-card,
        body:has(#page-squadron.active) #page-squadron.active .dorm-card,
        body:has(#page-processing.active) #page-processing.active > .flex-shrink-0,
        body:has(#page-processing.active) #page-processing.active .surface,
        body:has(#page-processing.active) #page-processing.active .proc-card,
        body:has(#page-processing.active) #page-processing.active #proc-dorm-grid,
        body:has(#page-processing.active) #page-processing.active [id*='loaded'],
        body:has(#page-processing.active) #page-processing.active [id*='arrived'] {
          position: relative !important;
          z-index: 1 !important;
          transform: translateZ(0) !important;
          backface-visibility: hidden !important;
          animation: none !important;
          transition-property: border-color, background-color, color, opacity, box-shadow !important;
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

  function start() {
    if (installed) return;
    installed = true;
    installStyles();
    window.GateRenderStabilityStyleGuard = Object.freeze({
      isStyleOnly: true,
      ownsPageState: false,
      ownsWatermark: false,
      statusBoardExcluded: true,
      refresh: installStyles
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
