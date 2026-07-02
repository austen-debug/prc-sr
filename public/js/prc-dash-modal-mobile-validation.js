// PRC GATE modal system + mobile access validation
// UI/UX layer only: modal fit, mobile-safe forms, and touch access to instructor Processing actions.
(function () {
  let started = false;
  let stylesReady = false;
  let longPressTimer = null;
  let longPressPoint = null;

  function currentRoleSafe() {
    try { return currentRole || 'airman'; } catch (_) { return 'airman'; }
  }

  function isInstructor() {
    return currentRoleSafe() === 'instructor';
  }

  function isTouchDevice() {
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  }

  function ensureStyles() {
    if (stylesReady || document.getElementById('prc-gate-modal-mobile-validation-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-gate-modal-mobile-validation-styles';
    style.textContent = `
      body.gate-modal-open {
        overflow: hidden !important;
      }

      .confirm-overlay {
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
      }

      .confirm-overlay > .modal-content,
      #confirm-dialog > .surface,
      #confirm-dialog > div {
        display: flex !important;
        flex-direction: column !important;
      }

      .modal-content > .flex.justify-between.items-center.mb-4 {
        position: sticky !important;
        top: 0 !important;
        z-index: 2 !important;
        background: linear-gradient(180deg, var(--gate-glass-bg-strong), rgba(15, 23, 42, 0.72)) !important;
        -webkit-backdrop-filter: blur(var(--gate-glass-blur, 16px)) saturate(1.12) !important;
        backdrop-filter: blur(var(--gate-glass-blur, 16px)) saturate(1.12) !important;
      }

      .modal-content form,
      .modal-content .space-y-4 {
        min-width: 0 !important;
      }

      .modal-content input,
      .modal-content select,
      .modal-content textarea,
      .modal-content button {
        min-width: 0 !important;
      }

      .modal-content input,
      .modal-content select {
        min-height: 2.65rem !important;
      }

      .modal-content textarea {
        max-height: 34dvh !important;
        resize: vertical !important;
      }

      .modal-content button {
        min-height: 2.6rem !important;
      }

      .modal-content .flex.gap-2,
      .modal-content .flex.gap-3 {
        flex-wrap: wrap !important;
      }

      .modal-content .flex.gap-2 > button,
      .modal-content .flex.gap-3 > button {
        min-width: min(100%, 8rem) !important;
      }

      @media (max-width: 760px) {
        .confirm-overlay {
          align-items: flex-start !important;
          justify-content: center !important;
          padding:
            max(0.75rem, env(safe-area-inset-top))
            0.75rem
            max(0.75rem, env(safe-area-inset-bottom)) !important;
        }

        .confirm-overlay > .modal-content,
        #confirm-dialog > .surface,
        #confirm-dialog > div {
          width: calc(100vw - 1.5rem) !important;
          max-width: calc(100vw - 1.5rem) !important;
          max-height: calc(100dvh - max(1.5rem, env(safe-area-inset-top) + env(safe-area-inset-bottom))) !important;
          margin: 0 auto !important;
          border-radius: 18px !important;
        }

        .modal-content > .flex.justify-between.items-center.mb-4 {
          margin: -0.15rem -0.15rem 0.85rem !important;
          padding: 0.2rem 0.2rem 0.72rem !important;
        }

        .modal-content h2,
        .modal-content h3 {
          max-width: calc(100% - 2.25rem) !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          font-size: 1.05rem !important;
          line-height: 1.05 !important;
        }

        .modal-content .grid,
        .modal-content .grid.grid-cols-2,
        .modal-content .grid.grid-cols-3,
        .modal-content .grid.grid-cols-4,
        .modal-content .gate-edit-record-grid,
        .modal-content .gate-airman-location-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .modal-content .flex.gap-2 > button,
        .modal-content .flex.gap-3 > button,
        .modal-content form > .flex button {
          flex: 1 1 100% !important;
          width: 100% !important;
        }

        #archive-edit-modal textarea {
          max-height: 24dvh !important;
        }

        .gate-processing-context-menu {
          left: 0.75rem !important;
          right: 0.75rem !important;
          bottom: max(0.75rem, env(safe-area-inset-bottom)) !important;
          top: auto !important;
          width: auto !important;
          max-width: none !important;
          border-radius: 20px !important;
          padding: 0.54rem !important;
        }

        .gate-processing-context-action {
          min-height: 2.85rem !important;
          padding: 0.72rem 0.78rem !important;
          font-size: 0.76rem !important;
        }
      }

      body.gate-touch-access-mode #processing-edit-hint:not(.hidden)::after {
        content: ' Long-press a dorm card for instructor actions on mobile.';
      }
    `;

    document.head.appendChild(style);
    stylesReady = true;
  }

  function normalizeModalState() {
    const modalOpen = Array.from(document.querySelectorAll('.confirm-overlay')).some(modal => !modal.classList.contains('hidden'));
    document.body.classList.toggle('gate-modal-open', modalOpen);
    document.body.classList.toggle('gate-touch-access-mode', isTouchDevice());
  }

  function dispatchCardContextMenu(card) {
    if (!card || !longPressPoint || !isInstructor()) return;
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: longPressPoint.x,
      clientY: longPressPoint.y,
      button: 2
    });
    card.dispatchEvent(event);
  }

  function handleTouchStart(event) {
    if (!isTouchDevice() || !isInstructor()) return;
    const card = event.target?.closest?.('#page-processing .proc-card');
    if (!card) return;

    const touch = event.touches && event.touches[0];
    if (!touch) return;

    longPressPoint = { x: touch.clientX, y: touch.clientY };
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      dispatchCardContextMenu(card);
    }, 560);
  }

  function clearLongPress() {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressPoint = null;
  }

  function runPass() {
    ensureStyles();
    normalizeModalState();
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    document.addEventListener('touchend', clearLongPress, true);
    document.addEventListener('touchcancel', clearLongPress, true);
    document.addEventListener('touchmove', clearLongPress, true);
    runPass();
    setInterval(runPass, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
