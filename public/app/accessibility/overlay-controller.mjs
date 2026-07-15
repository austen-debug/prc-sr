import { FOCUSABLE_SELECTOR, isEscapeKey, resolveTabDestination } from './focus-contract.mjs';

function visibleFocusableElements(container) {
  if (!container?.querySelectorAll) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(element => {
    if (element.hidden || element.getAttribute?.('aria-hidden') === 'true') return false;
    return element.getClientRects?.().length !== 0 || element === container.ownerDocument?.activeElement;
  });
}

function setBackgroundInert(documentRef, overlay, inert, snapshots) {
  const body = documentRef?.body;
  if (!body || !overlay) return;
  const overlayHost = [...body.children].find(child => child === overlay || child.contains?.(overlay));
  for (const child of body.children) {
    if (child === overlayHost) continue;
    if (inert) {
      if (!snapshots.has(child)) snapshots.set(child, {
        inert: Boolean(child.inert),
        ariaHidden: child.getAttribute('aria-hidden')
      });
      child.inert = true;
      child.setAttribute('aria-hidden', 'true');
    } else if (snapshots.has(child)) {
      const previous = snapshots.get(child);
      child.inert = previous.inert;
      if (previous.ariaHidden === null) child.removeAttribute('aria-hidden');
      else child.setAttribute('aria-hidden', previous.ariaHidden);
      snapshots.delete(child);
    }
  }
}

export function createGateOverlayController({ documentRef = globalThis.document } = {}) {
  let active = null;
  let returnFocus = null;
  const backgroundSnapshots = new Map();

  function focusInitial(overlay) {
    const explicit = overlay.querySelector?.('[data-gate-initial-focus]');
    const focusable = visibleFocusableElements(overlay);
    const target = explicit || focusable[0] || overlay;
    if (!target.hasAttribute?.('tabindex') && target === overlay) target.setAttribute?.('tabindex', '-1');
    target.focus?.({ preventScroll: true });
  }

  function open(overlay, trigger = documentRef?.activeElement) {
    if (!overlay) return false;
    if (active && active !== overlay) close(active, { restoreFocus: false });
    active = overlay;
    returnFocus = trigger?.focus ? trigger : null;
    overlay.setAttribute?.('data-gate-overlay-state', 'open');
    overlay.setAttribute?.('aria-modal', 'true');
    if (overlay.tagName === 'DIALOG' && typeof overlay.showModal === 'function' && !overlay.open) overlay.showModal();
    else overlay.hidden = false;
    setBackgroundInert(documentRef, overlay, true, backgroundSnapshots);
    focusInitial(overlay);
    return true;
  }

  function close(overlay = active, { restoreFocus = true } = {}) {
    if (!overlay || overlay !== active) return false;
    if (overlay.tagName === 'DIALOG' && typeof overlay.close === 'function' && overlay.open) overlay.close();
    else overlay.hidden = true;
    overlay.setAttribute?.('data-gate-overlay-state', 'closed');
    setBackgroundInert(documentRef, overlay, false, backgroundSnapshots);
    const target = returnFocus;
    active = null;
    returnFocus = null;
    if (restoreFocus) target?.focus?.({ preventScroll: true });
    return true;
  }

  function handleKeydown(event) {
    if (!active) return;
    if (isEscapeKey(event)) {
      event.preventDefault?.();
      event.stopPropagation?.();
      close(active);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = visibleFocusableElements(active);
    if (!focusable.length) {
      event.preventDefault?.();
      active.focus?.();
      return;
    }
    const currentIndex = focusable.indexOf(documentRef.activeElement);
    const destination = resolveTabDestination({ currentIndex, count: focusable.length, shiftKey: event.shiftKey });
    const atBoundary = event.shiftKey ? currentIndex <= 0 : currentIndex === focusable.length - 1 || currentIndex < 0;
    if (atBoundary) {
      event.preventDefault?.();
      focusable[destination]?.focus?.();
    }
  }

  function handleClick(event) {
    if (!active) return;
    const closeControl = event.target?.closest?.('[data-gate-action="close"]');
    if (closeControl && active.contains?.(closeControl)) {
      event.preventDefault?.();
      close(active);
    }
  }

  function handleCancel(event) {
    if (!active || event.target !== active) return;
    event.preventDefault?.();
    close(active);
  }

  documentRef?.addEventListener?.('keydown', handleKeydown, true);
  documentRef?.addEventListener?.('click', handleClick, true);
  documentRef?.addEventListener?.('cancel', handleCancel, true);

  return Object.freeze({
    open,
    close,
    getActiveOverlay: () => active,
    destroy() {
      if (active) close(active, { restoreFocus: false });
      documentRef?.removeEventListener?.('keydown', handleKeydown, true);
      documentRef?.removeEventListener?.('click', handleClick, true);
      documentRef?.removeEventListener?.('cancel', handleCancel, true);
    }
  });
}
