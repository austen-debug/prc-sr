export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'details > summary:first-of-type',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function isEscapeKey(event = {}) {
  return event.key === 'Escape' || event.key === 'Esc';
}

export function resolveTabDestination({ currentIndex = -1, count = 0, shiftKey = false } = {}) {
  if (!Number.isInteger(count) || count <= 0) return -1;
  const index = Number.isInteger(currentIndex) ? currentIndex : -1;
  if (shiftKey) return index <= 0 ? count - 1 : index - 1;
  return index < 0 || index >= count - 1 ? 0 : index + 1;
}

export function normalizeAnnouncement(input = {}) {
  const message = String(input.message || '').trim();
  const urgency = input.urgency === 'assertive' || input.blocking === true ? 'assertive' : 'polite';
  return Object.freeze({
    message,
    urgency,
    role: urgency === 'assertive' ? 'alert' : 'status',
    atomic: true
  });
}

export function validateOverlayDescriptor(descriptor = {}) {
  const errors = [];
  if (!['dialog', 'sheet'].includes(descriptor.kind)) errors.push('Overlay kind must be dialog or sheet.');
  if (!String(descriptor.id || '').trim()) errors.push('Overlay requires an id.');
  if (!String(descriptor.labelledBy || descriptor.label || '').trim()) errors.push('Overlay requires an accessible name.');
  if (descriptor.escapeCloses !== true) errors.push('Overlay must close with Escape.');
  if (descriptor.returnFocus !== true) errors.push('Overlay must return focus.');
  if (descriptor.containFocus !== true) errors.push('Overlay must contain focus.');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
