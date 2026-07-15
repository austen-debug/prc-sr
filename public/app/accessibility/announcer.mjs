import { normalizeAnnouncement } from './focus-contract.mjs';

export function createGateAnnouncer({ documentRef = globalThis.document, root = documentRef?.body } = {}) {
  function ensureRegion(urgency) {
    const id = urgency === 'assertive' ? 'gate-live-assertive' : 'gate-live-polite';
    let region = documentRef?.getElementById?.(id);
    if (!region && documentRef?.createElement && root?.appendChild) {
      region = documentRef.createElement('div');
      region.id = id;
      region.className = 'gate-visually-hidden gate-live-region';
      region.setAttribute('role', urgency === 'assertive' ? 'alert' : 'status');
      region.setAttribute('aria-live', urgency);
      region.setAttribute('aria-atomic', 'true');
      root.appendChild(region);
    }
    return region;
  }

  function announce(input) {
    const announcement = normalizeAnnouncement(typeof input === 'string' ? { message: input } : input);
    if (!announcement.message) return false;
    const region = ensureRegion(announcement.urgency);
    if (!region) return false;
    region.textContent = '';
    queueMicrotask(() => { region.textContent = announcement.message; });
    return true;
  }

  return Object.freeze({ announce, ensureRegion });
}
