export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

export function toId(value, fallback = 'gate-component') {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function classNames(...values) {
  return values.flatMap(value => {
    if (!value) return [];
    if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'object') return Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([name]) => name);
    return [];
  }).join(' ');
}

export function renderActionButton(action = {}, defaultVariant = 'secondary') {
  const label = escapeHtml(action.label || 'Action');
  const actionId = escapeAttribute(action.action || action.id || 'action');
  const variant = escapeAttribute(action.variant || defaultVariant);
  const disabled = action.disabled ? ' disabled aria-disabled="true"' : '';
  return `<button class="gate-button gate-button--${variant}" type="button" data-gate-action="${actionId}"${disabled}>${label}</button>`;
}

export function renderActions(actions = [], defaultVariant = 'secondary') {
  return (Array.isArray(actions) ? actions : []).map(action => renderActionButton(action, defaultVariant)).join('');
}
