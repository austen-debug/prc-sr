// GATE Airman modal close safety
// Makes Processing dorm modal close/X behavior safe for Airman access without touching records.
(function () {
  'use strict';

  let installed = false;
  let patched = false;
  let scheduled = false;

  function currentRoleSafe() {
    try { return currentRole || 'airman'; } catch (_) { return 'airman'; }
  }

  function isAirman() {
    return currentRoleSafe() === 'airman';
  }

  function ensureProcessingActive() {
    const processing = document.getElementById('page-processing');
    if (!processing) return;

    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    processing.classList.add('active');

    try {
      const navButtons = document.querySelectorAll('[data-page], .nav-btn');
      navButtons.forEach(button => {
        const isProcessing = button.dataset?.page === 'processing' || /processing/i.test(button.textContent || '');
        button.classList.toggle('active', Boolean(isProcessing));
      });
    } catch (_) {}
  }

  function clearDormModalState() {
    try { modalDormId = null; } catch (_) {}

    const modal = document.getElementById('dorm-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }

    document.body.classList.remove('gate-modal-open');
    document.body.classList.remove('gate-tablet-dorm-modal-open');
  }

  function safeCloseDormModal(event) {
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
    }

    try {
      clearDormModalState();
      if (isAirman()) ensureProcessingActive();
      if (typeof renderProcessingPage === 'function') {
        try { renderProcessingPage(); } catch (_) {}
      }
      if (typeof window.runGateHooks === 'function') {
        try { window.runGateHooks('afterPageChange', { source: 'airman-modal-close-safety' }); } catch (_) {}
      }
    } catch (error) {
      console.warn('GATE safe dorm modal close recovered from an error:', error);
      try { clearDormModalState(); } catch (_) {}
      if (isAirman()) {
        try { ensureProcessingActive(); } catch (_) {}
      }
    }

    return false;
  }

  function hardenCloseButtons() {
    document.querySelectorAll('#dorm-modal button').forEach(button => {
      const onclick = button.getAttribute('onclick') || '';
      const isClose = onclick.includes('closeDormModal') || (button.textContent || '').trim() === '×';
      if (!isClose) return;

      button.type = 'button';
      button.setAttribute('aria-label', 'Close dorm details and return to Processing');
      button.dataset.gateSafeClose = 'true';
    });
  }

  function patchCloseFunction() {
    if (patched) return;

    let original = null;
    try { original = window.closeDormModal || closeDormModal; } catch (_) { original = window.closeDormModal || null; }

    const patchedClose = function gateSafeCloseDormModal(event) {
      return safeCloseDormModal(event);
    };

    patchedClose.__gateAirmanSafeClose = true;
    patchedClose.__gateOriginal = original;
    window.closeDormModal = patchedClose;
    try { closeDormModal = patchedClose; } catch (_) {}
    patched = true;
  }

  function handleClick(event) {
    const target = event.target;
    if (!target?.closest) return;
    const closeButton = target.closest('#dorm-modal [data-gate-safe-close="true"], #dorm-modal button[onclick*="closeDormModal"]');
    if (!closeButton) return;
    safeCloseDormModal(event);
  }

  function handleKeydown(event) {
    if (event.key !== 'Escape') return;
    const modal = document.getElementById('dorm-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    safeCloseDormModal(event);
  }

  function runPass() {
    scheduled = false;
    hardenCloseButtons();
    patchCloseFunction();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(runPass);
  }

  function start() {
    if (installed) return;
    installed = true;
    patchCloseFunction();
    hardenCloseButtons();
    document.addEventListener('click', handleClick, true);
    document.addEventListener('touchend', handleClick, true);
    document.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('resize', schedule, true);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'onclick'] });
    window.registerGateHook?.('afterModalOpen', schedule);
    window.registerGateHook?.('afterPageChange', schedule);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
