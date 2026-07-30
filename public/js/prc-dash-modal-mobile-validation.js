// GATE Processing modal workspace and touch validation controller
// Owns responsive modal fit, topmost-modal keyboard cancellation, and the shared
// post-persistence return-to-Processing lifecycle. Record mutation remains owned
// by GateProcessingController and the Data SDK.
(function () {
  'use strict';

  const WORKSPACE_STYLESHEET = '/css/gate-processing-modal-workspace.css?v=closed-dorm-layout-20260729';
  const WRAPPED_UPDATE = Symbol.for('gate.processing.persistence.update.wrapped');
  const WRAPPED_DELETE = Symbol.for('gate.processing.persistence.delete.wrapped');

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

  function isVisible(element) {
    return Boolean(element && !element.classList.contains('hidden') && element.getAttribute('aria-hidden') !== 'true');
  }

  function ensureWorkspaceStylesheet() {
    if (document.querySelector('link[data-gate-processing-modal-workspace="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = WORKSPACE_STYLESHEET;
    link.dataset.gateProcessingModalWorkspace = 'true';
    document.head.appendChild(link);
  }

  function classifyProcessingModals() {
    const processingModal = document.getElementById('dorm-modal');
    const processingContent = processingModal?.querySelector(':scope > .modal-content');
    if (processingModal && processingContent) {
      processingModal.dataset.modalOwner = 'gate-processing-modal-workspace';
      processingModal.setAttribute('role', 'presentation');
      processingContent.classList.add('gate-processing-workspace');
      processingContent.setAttribute('role', 'dialog');
      processingContent.setAttribute('aria-modal', 'true');
      processingContent.setAttribute('aria-labelledby', 'modal-dorm-name');
      processingContent.querySelector(':scope > .flex.justify-between.items-center.mb-4')?.classList.add('gate-processing-workspace__header');
      document.getElementById('modal-dorm-info')?.classList.add('gate-processing-workspace__meta');
      document.getElementById('modal-airman-input')?.closest('.mb-6')?.classList.add('gate-processing-workspace__assignment');
      document.getElementById('modal-phase-section')?.classList.add('gate-processing-workspace__phase');
      document.getElementById('modal-load-section')?.classList.add('gate-processing-workspace__load');
      document.getElementById('modal-action-section')?.classList.add('gate-processing-workspace__footer');
    }

    const editModal = document.getElementById('dorm-edit-modal');
    const editContent = editModal?.querySelector(':scope > .modal-content');
    if (editModal && editContent) {
      editModal.dataset.modalOwner = 'gate-processing-modal-workspace';
      editModal.setAttribute('role', 'presentation');
      editContent.classList.add('gate-processing-edit-workspace');
      editContent.setAttribute('role', 'dialog');
      editContent.setAttribute('aria-modal', 'true');
      editContent.setAttribute('aria-label', 'Edit Dorm Record');
      editContent.querySelector(':scope > .flex.justify-between.items-center.mb-4')?.classList.add('gate-processing-edit-workspace__header');
      document.getElementById('dorm-edit-form')?.classList.add('gate-processing-edit-workspace__form');
      document.querySelector('#dorm-edit-form > .flex.gap-2.pt-3')?.classList.add('gate-processing-edit-workspace__footer');
    }
  }

  function normalizeModalState() {
    const modalOpen = Array.from(document.querySelectorAll('.confirm-overlay')).some(isVisible);
    document.body.classList.toggle('gate-modal-open', modalOpen);
    document.body.classList.toggle('gate-touch-access-mode', isTouchDevice());
    classifyProcessingModals();
  }

  function getAllDataSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function normalizeTimer(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{1,5}):([0-5]\d)$/);
    if (!match) return raw;
    return `${String(Number(match[1] || 0)).padStart(2, '0')}:${match[2]}`;
  }

  function withManualClosedTimerOverride(record) {
    if (!record || record.type !== 'dorm' || !record.__backendId) return record;
    const existing = getAllDataSafe().find(item => item?.type === 'dorm' && item.__backendId === record.__backendId);
    if (!existing) return record;

    const existingState = String(existing.state || '').toLowerCase();
    const incomingState = String(record.state || existing.state || '').toLowerCase();
    const incomingTimer = normalizeTimer(record.closed_timer);
    const existingTimer = normalizeTimer(existing.closed_timer);

    if (existingState !== 'closed' || incomingState !== 'closed') return record;
    if (!/^\d{1,5}:[0-5]\d$/.test(incomingTimer) || incomingTimer === existingTimer) return record;

    return {
      ...record,
      closed_timer: incomingTimer,
      manual_closed_timer_override: 'true'
    };
  }

  function isProcessingDormMutation(record) {
    if (record?.type !== 'dorm') return false;
    return isVisible(document.getElementById('dorm-modal')) || isVisible(document.getElementById('dorm-edit-modal'));
  }

  function returnToProcessingAfterSuccess() {
    const editModal = document.getElementById('dorm-edit-modal');
    const processingModal = document.getElementById('dorm-modal');

    if (isVisible(editModal)) {
      if (typeof window.closeDormEditModal === 'function') window.closeDormEditModal();
      else {
        editModal.classList.add('hidden');
        editModal.setAttribute('aria-hidden', 'true');
      }
    }

    if (isVisible(processingModal)) {
      if (typeof window.closeDormModal === 'function') window.closeDormModal();
      else {
        processingModal.classList.add('hidden');
        processingModal.setAttribute('aria-hidden', 'true');
      }
    }

    try {
      if (typeof window.showPage === 'function') window.showPage('processing');
      else if (typeof showPage === 'function') showPage('processing');
    } catch (_) {}

    try { window.GateProcessingController?.scheduleRender?.({ force: true }); } catch (_) {}
    normalizeModalState();
  }

  function installProcessingPersistenceLifecycle() {
    const sdk = window.dataSdk;
    if (!sdk) return;

    if (typeof sdk.update === 'function' && !sdk.update[WRAPPED_UPDATE]) {
      const originalUpdate = sdk.update.bind(sdk);
      const wrappedUpdate = async function gateProcessingUpdate(record) {
        const payload = withManualClosedTimerOverride(record);
        const result = await originalUpdate(payload);
        if (result?.isOk && isProcessingDormMutation(payload)) returnToProcessingAfterSuccess();
        return result;
      };
      Object.defineProperty(wrappedUpdate, WRAPPED_UPDATE, { value: true });
      sdk.update = wrappedUpdate;
    }

    if (typeof sdk.delete === 'function' && !sdk.delete[WRAPPED_DELETE]) {
      const originalDelete = sdk.delete.bind(sdk);
      const wrappedDelete = async function gateProcessingDelete(record) {
        const result = await originalDelete(record);
        if (result?.isOk && isProcessingDormMutation(record)) returnToProcessingAfterSuccess();
        return result;
      };
      Object.defineProperty(wrappedDelete, WRAPPED_DELETE, { value: true });
      sdk.delete = wrappedDelete;
    }
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
    longPressTimer = window.setTimeout(() => {
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

  function cancelTopmostProcessingModal(event) {
    const editModal = document.getElementById('dorm-edit-modal');
    if (isVisible(editModal)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      window.closeDormEditModal?.();
      normalizeModalState();
      return true;
    }

    const processingModal = document.getElementById('dorm-modal');
    if (isVisible(processingModal)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      window.closeDormModal?.();
      normalizeModalState();
      return true;
    }

    return false;
  }

  function handleWindowKeydown(event) {
    if (event.key === 'Escape') {
      cancelTopmostProcessingModal(event);
      return;
    }

    if (event.key !== 'Enter' || event.isComposing) return;
    if (event.target?.id === 'modal-load-input') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      window.saveLoad?.();
    }
  }

  function runPass() {
    passScheduled = false;
    ensureWorkspaceStylesheet();
    installProcessingPersistenceLifecycle();
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
      attributeFilter: ['class', 'aria-hidden']
    });
  }

  function start() {
    if (started) return;
    started = true;
    ensureWorkspaceStylesheet();
    installProcessingPersistenceLifecycle();
    classifyProcessingModals();
    window.addEventListener('keydown', handleWindowKeydown, true);
    document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    document.addEventListener('touchend', () => { clearLongPress(); schedulePass(); }, true);
    document.addEventListener('touchcancel', () => { clearLongPress(); schedulePass(); }, true);
    document.addEventListener('touchmove', clearLongPress, true);
    window.addEventListener('resize', schedulePass, true);
    window.addEventListener('orientationchange', schedulePass, true);
    window.registerGateHook?.('afterModalOpen', schedulePass);
    window.registerGateHook?.('afterPageChange', schedulePass);
    window.registerGateHook?.('afterDataChanged', schedulePass);
    observeModalTargets();
    schedulePass();

    window.GateModalTouchValidation = Object.freeze({
      isNarrowed: true,
      ownsWatermark: false,
      ownsAirportLayout: false,
      ownsNavigation: false,
      ownsProcessingCompletionLifecycle: true,
      refresh: schedulePass
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
