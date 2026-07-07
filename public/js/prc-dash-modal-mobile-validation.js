// PRC GATE modal system + mobile access validation
// Behavior layer for mobile/touch modal state and device-discovered mobile UI corrections.
(function () {
  let started = false;
  let passScheduled = false;
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

  function installMobileUiCorrections() {
    if (document.getElementById('gate-mobile-runtime-corrections')) return;

    const style = document.createElement('style');
    style.id = 'gate-mobile-runtime-corrections';
    style.textContent = `
      body.fullscreen-board {
        height: 100dvh !important;
        max-height: 100dvh !important;
        overflow: hidden !important;
      }

      body.fullscreen-board #page-board.active,
      body.fullscreen-board #page-board {
        height: 100dvh !important;
        min-height: 0 !important;
        max-height: 100dvh !important;
        box-sizing: border-box !important;
        padding: calc(var(--gate-shell-offset-clean, 78px) + 10px) clamp(0.55rem, 0.82vw, 1rem) 1rem !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
        -webkit-overflow-scrolling: touch !important;
        scroll-padding-top: calc(var(--gate-shell-offset-clean, 78px) + 14px) !important;
        scroll-padding-bottom: 2rem !important;
      }

      body.fullscreen-board #page-board .board-header.prc-header-v3 {
        margin-top: 0 !important;
        margin-bottom: 0.58rem !important;
      }

      body.fullscreen-board #page-board .dorm-dashboard {
        align-items: start !important;
        padding-bottom: 1rem !important;
      }

      body.fullscreen-board #page-board .dorm-column,
      body.fullscreen-board #page-board .dorm-col-content {
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
      }

      body.fullscreen-board #page-board .gate-dorm-card,
      body.fullscreen-board #page-board .dorm-card {
        contain: layout paint !important;
      }

      @media (min-width: 1025px) {
        body.fullscreen-board #page-board .board-header.prc-header-v3 {
          grid-template-columns: minmax(340px, 0.58fr) minmax(420px, 1fr) !important;
        }

        body.fullscreen-board #page-board .prc-metric-card-v3 {
          min-height: 72px !important;
          padding-top: 0.52rem !important;
          padding-bottom: 0.52rem !important;
        }

        body.fullscreen-board #page-board .prc-active-buses-v3 {
          min-height: 112px !important;
        }
      }

      @media (max-width: 767px) {
        #page-airport {
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }

        #page-airport .max-w-3xl {
          max-width: none !important;
          width: 100% !important;
          min-width: 0 !important;
        }

        #page-airport #airport-form {
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
          justify-content: flex-start !important;
          gap: 0.82rem !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          overflow-x: hidden !important;
          overflow-y: visible !important;
          padding: 1rem !important;
          scroll-snap-type: none !important;
          -webkit-overflow-scrolling: auto !important;
        }

        #page-airport #airport-form > * {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin-top: 0 !important;
          scroll-snap-align: none !important;
        }

        #page-airport #airport-form h3 {
          font-size: 0.98rem !important;
          line-height: 1.15 !important;
          letter-spacing: 0.11em !important;
          margin-bottom: 0.1rem !important;
        }

        #page-airport #airport-form label {
          font-size: 0.78rem !important;
          line-height: 1.15 !important;
          white-space: normal !important;
        }

        #page-airport #airport-form input {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          min-height: 48px !important;
          font-size: 1rem !important;
          box-sizing: border-box !important;
        }

        #page-airport #airport-form button[type='submit'] {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 48px !important;
          height: auto !important;
          align-self: stretch !important;
          margin-top: 0.15rem !important;
        }

        #page-airport #airport-form #airport-msg {
          min-height: 1.1rem !important;
          text-align: center !important;
          white-space: normal !important;
        }

        #page-airport .surface:has(#airport-bus-log-body) {
          overflow-x: auto !important;
          overflow-y: hidden !important;
          -webkit-overflow-scrolling: touch !important;
        }

        #page-airport .surface:has(#airport-bus-log-body) table {
          min-width: 760px !important;
        }

        #dorm-modal.confirm-overlay {
          align-items: flex-start !important;
          justify-content: center !important;
          padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)) !important;
        }

        #dorm-modal .modal-content {
          width: calc(100vw - 16px) !important;
          max-width: calc(100vw - 16px) !important;
          max-height: calc(100dvh - max(20px, env(safe-area-inset-top) + env(safe-area-inset-bottom))) !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch !important;
          padding: 0.82rem 0.82rem calc(0.9rem + env(safe-area-inset-bottom)) !important;
          scroll-padding-bottom: 6.2rem !important;
        }

        #dorm-modal .modal-content > .flex.justify-between.items-center.mb-4 {
          position: sticky !important;
          top: 0 !important;
          z-index: 4 !important;
          margin: -0.35rem -0.35rem 0.62rem !important;
          padding: 0.58rem 0.68rem !important;
          min-height: 3.25rem !important;
        }

        #dorm-modal #modal-dorm-name {
          font-size: clamp(1.45rem, 8.8vw, 2.05rem) !important;
        }

        #dorm-modal #modal-dorm-info {
          margin-bottom: 0.65rem !important;
          padding: 0.46rem 0.56rem !important;
          font-size: 0.7rem !important;
        }

        #dorm-modal .mb-6,
        #dorm-modal #modal-phase-section,
        #dorm-modal #modal-load-section {
          margin-bottom: 0.7rem !important;
        }

        #dorm-modal #modal-phase-buttons {
          gap: 0.42rem !important;
        }

        #dorm-modal .phase-btn {
          min-height: 2.55rem !important;
          padding: 0.58rem 0.62rem !important;
          font-size: 0.78rem !important;
        }

        #dorm-modal #modal-load-section > .flex.items-center.justify-center.gap-4 {
          grid-template-columns: 2.35rem 2.35rem minmax(4.7rem, 1fr) 2.35rem 2.35rem !important;
          gap: 0.32rem !important;
          margin-bottom: 0.52rem !important;
        }

        #dorm-modal .load-btn {
          width: 2.35rem !important;
          height: 2.35rem !important;
          min-width: 2.35rem !important;
          min-height: 2.35rem !important;
        }

        #dorm-modal #modal-load-input {
          min-height: 3.28rem !important;
          font-size: clamp(1.62rem, 9vw, 2.1rem) !important;
        }

        #dorm-modal #modal-load-section > .flex.gap-2.justify-center > button {
          min-height: 2.5rem !important;
          font-size: 0.78rem !important;
        }

        #dorm-modal #modal-action-section {
          position: sticky !important;
          bottom: calc(-0.9rem - env(safe-area-inset-bottom)) !important;
          z-index: 5 !important;
          margin: 0.55rem -0.82rem calc(-0.9rem - env(safe-area-inset-bottom)) !important;
          padding: 0.72rem 0.82rem calc(0.82rem + env(safe-area-inset-bottom)) !important;
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 0.55rem !important;
          border-top: 1px solid rgba(148, 163, 184, 0.24) !important;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.50), rgba(15, 23, 42, 0.95) 24%, rgba(15, 23, 42, 0.98)) !important;
          -webkit-backdrop-filter: blur(18px) saturate(1.15) !important;
          backdrop-filter: blur(18px) saturate(1.15) !important;
        }

        #dorm-modal #modal-action-section button {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 2.82rem !important;
          font-size: 0.82rem !important;
        }

        #page-board #active-buses .bus-badge,
        #page-board #active-buses .prc-bus-card {
          position: relative !important;
          min-height: 108px !important;
          padding-bottom: 28px !important;
          cursor: pointer !important;
          touch-action: manipulation !important;
        }

        #page-board #active-buses .bus-badge::after,
        #page-board #active-buses .prc-bus-card::after {
          content: 'TAP TO ACCEPT' !important;
          position: absolute !important;
          left: 8px !important;
          right: 8px !important;
          bottom: 7px !important;
          min-height: 18px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid rgba(134, 239, 172, 0.42) !important;
          border-radius: 999px !important;
          background: rgba(22, 163, 74, 0.20) !important;
          color: #dcfce7 !important;
          font-size: 0.56rem !important;
          font-weight: 950 !important;
          letter-spacing: 0.12em !important;
          line-height: 1 !important;
          text-align: center !important;
          text-transform: uppercase !important;
          pointer-events: none !important;
        }

        .theme-light #page-board #active-buses .bus-badge::after,
        .theme-light #page-board #active-buses .prc-bus-card::after {
          background: rgba(22, 163, 74, 0.13) !important;
          color: #166534 !important;
          border-color: rgba(22, 163, 74, 0.30) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function normalizeModalState() {
    installMobileUiCorrections();
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
      schedulePass();
    }, 560);
  }

  function clearLongPress() {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressPoint = null;
  }

  function runPass() {
    passScheduled = false;
    normalizeModalState();
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(runPass);
  }

  function observeModalTargets() {
    const observer = new MutationObserver(schedulePass);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function start() {
    if (started) return;
    started = true;
    installMobileUiCorrections();
    document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    document.addEventListener('touchend', () => { clearLongPress(); schedulePass(); }, true);
    document.addEventListener('touchcancel', () => { clearLongPress(); schedulePass(); }, true);
    document.addEventListener('touchmove', clearLongPress, true);
    document.addEventListener('click', schedulePass, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') schedulePass();
    }, true);
    window.addEventListener('resize', schedulePass, true);
    observeModalTargets();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
