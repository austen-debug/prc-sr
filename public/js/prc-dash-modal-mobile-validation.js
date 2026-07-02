// PRC GATE modal system + mobile access validation
// Behavior-only layer. Canonical styles live in /css/prc-dash-modal-systems.css.
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
