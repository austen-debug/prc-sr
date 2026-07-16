export const GATE_SHELL_CACHE_NAME = 'gate-build-2-shell-v1';

export const GATE_STATIC_SHELL_ASSETS = Object.freeze([
  '/app/design/gate-design.css',
  '/app/components/gate-components.css',
  '/app/shell/gate-shell.css',
  '/app/responsive/gate-responsive.css',
  '/app/accessibility/gate-accessibility.css',
  '/app/shell/index.mjs',
  '/app/shell/route-registry.mjs',
  '/app/shell/permission-registry.mjs',
  '/app/shell/shell-state.mjs',
  '/app/shell/shell-store.mjs',
  '/app/shell/selectors.mjs',
  '/app/shell/renderers.mjs'
]);

export function requestPath(input) {
  try {
    return new URL(typeof input === 'string' ? input : input?.url, 'https://gate.local').pathname;
  } catch (_) {
    return '';
  }
}

export function isAuthoritativeApiRequest(input) {
  return requestPath(input).startsWith('/api/');
}

export function isCacheableShellRequest(input) {
  const method = String(input?.method || 'GET').toUpperCase();
  return method === 'GET' && GATE_STATIC_SHELL_ASSETS.includes(requestPath(input));
}

export function validateCachePolicy() {
  const errors = [];
  const unique = new Set(GATE_STATIC_SHELL_ASSETS);
  if (unique.size !== GATE_STATIC_SHELL_ASSETS.length) errors.push('Static shell cache manifest contains duplicate assets.');
  for (const asset of GATE_STATIC_SHELL_ASSETS) {
    if (!asset.startsWith('/app/')) errors.push(`Non-Build-2 asset is not permitted in shell cache: ${asset}.`);
    if (/api|record|archive|audit|workflow|fixture/i.test(asset)) errors.push(`Operational asset is not permitted in shell cache: ${asset}.`);
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
