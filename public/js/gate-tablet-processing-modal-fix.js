// GATE tablet Processing modal accessibility fix
// Keeps Processing dorm modal Airman/save controls reachable on iPad/tablet touch viewports.
(function () {
  'use strict';

  let installed = false;
  let scheduled = false;

  function installStyles() {
    if (document.getElementById('gate-tablet-processing-modal-fix')) return;

    const style = document.createElement('style');
    style.id = 'gate-tablet-processing-modal-fix';
    style.textContent = `
      @media (min-width: 768px) and (max-width: 1180px) and (pointer: coarse) {
        #dorm-modal.confirm-overlay {
          align-items: flex-start !important;
          justify-content: center !important;
          padding:
            max(12px, env(safe-area-inset-top))
            max(18px, env(safe-area-inset-right))
            max(18px, env(safe-area-inset-bottom))
            max(18px, env(safe-area-inset-left)) !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch !important;
        }

        #dorm-modal .modal-content {
          width: min(720px, calc(100vw - 36px)) !important;
          max-width: calc(100vw - 36px) !important;
          max-height: calc(100dvh - max(34px, env(safe-area-inset-top) + env(safe-area-inset-bottom) + 24px)) !important;
          min-height: 0 !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch !important;
          padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom)) !important;
          scroll-padding-bottom: 7rem !important;
        }

        #dorm-modal .modal-content > .flex.justify-between.items-center.mb-4 {
          position: sticky !important;
          top: 0 !important;
          z-index: 6 !important;
          margin: -0.35rem -0.35rem 0.75rem !important;
          padding: 0.72rem 0.82rem !important;
          min-height: 3.45rem !important;
          border-radius: 14px !important;
          background: color-mix(in srgb, var(--bg-card, #0f172a) 92%, transparent) !important;
          -webkit-backdrop-filter: blur(18px) saturate(1.12) !important;
          backdrop-filter: blur(18px) saturate(1.12) !important;
        }

        #dorm-modal #modal-dorm-name {
          font-size: clamp(1.75rem, 4.8vw, 2.45rem) !important;
          line-height: 0.95 !important;
        }

        #dorm-modal #modal-dorm-info {
          margin-bottom: 0.75rem !important;
          padding: 0.55rem 0.68rem !important;
          font-size: 0.78rem !important;
          line-height: 1.12 !important;
        }

        #dorm-modal #modal-phase-section,
        #dorm-modal #modal-load-section,
        #dorm-modal .mb-6 {
          margin-bottom: 0.82rem !important;
        }

        #dorm-modal #modal-phase-buttons {
          gap: 0.52rem !important;
        }

        #dorm-modal .phase-btn {
          min-height: 2.7rem !important;
          padding: 0.62rem 0.72rem !important;
          font-size: 0.82rem !important;
        }

        #dorm-modal #modal-load-section > .flex.items-center.justify-center.gap-4 {
          grid-template-columns: 2.7rem 2.7rem minmax(5.6rem, 1fr) 2.7rem 2.7rem !important;
          gap: 0.45rem !important;
          margin-bottom: 0.62rem !important;
        }

        #dorm-modal .load-btn {
          width: 2.7rem !important;
          height: 2.7rem !important;
          min-width: 2.7rem !important;
          min-height: 2.7rem !important;
        }

        #dorm-modal #modal-load-input {
          min-height: 3.42rem !important;
          font-size: clamp(1.8rem, 5.6vw, 2.35rem) !important;
        }

        #dorm-modal #modal-load-section > .flex.gap-2.justify-center > button {
          min-height: 2.65rem !important;
          font-size: 0.82rem !important;
        }

        #dorm-modal #modal-airman-input,
        #dorm-modal #modal-airman-save,
        #dorm-modal input,
        #dorm-modal button {
          min-height: 44px !important;
        }

        #dorm-modal #modal-action-section {
          position: sticky !important;
          bottom: calc(-1rem - env(safe-area-inset-bottom)) !important;
          z-index: 7 !important;
          margin: 0.7rem -1rem calc(-1rem - env(safe-area-inset-bottom)) !important;
          padding: 0.82rem 1rem calc(0.95rem + env(safe-area-inset-bottom)) !important;
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 0.65rem !important;
          border-top: 1px solid rgba(148, 163, 184, 0.24) !important;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.42), rgba(15, 23, 42, 0.95) 24%, rgba(15, 23, 42, 0.98)) !important;
          -webkit-backdrop-filter: blur(18px) saturate(1.15) !important;
          backdrop-filter: blur(18px) saturate(1.15) !important;
        }

        #dorm-modal #modal-action-section button,
        #dorm-modal #modal-action-section .px-8,
        #dorm-modal #modal-action-section .py-3 {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 3rem !important;
          font-size: 0.9rem !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function normalizeOpenDormModal() {
    installStyles();
    const modal = document.getElementById('dorm-modal');
    if (!modal) return;
    const open = !modal.classList.contains('hidden');
    document.body.classList.toggle('gate-tablet-dorm-modal-open', open);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      normalizeOpenDormModal();
    });
  }

  function start() {
    if (installed) return;
    installed = true;
    installStyles();
    document.addEventListener('click', schedule, true);
    document.addEventListener('touchend', schedule, true);
    document.addEventListener('keydown', schedule, true);
    window.addEventListener('resize', schedule, true);
    window.addEventListener('orientationchange', schedule, true);
    window.registerGateHook?.('afterModalOpen', schedule);
    window.registerGateHook?.('afterPageChange', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
