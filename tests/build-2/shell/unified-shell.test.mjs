import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROUTES,
  allowedRoutesForRole,
  canAccessRoute,
  createShellState,
  createShellStore,
  defaultRouteForRole,
  normalizeShellRole,
  reduceShellState,
  renderGateAppShell,
  renderGateNavigation,
  selectNavigationModel,
  selectPersistenceAnnouncement,
  validatePermissionRegistry,
  validateRouteRegistry,
  validateShellState
} from '../../../public/app/shell/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '../../..');
const fixture = JSON.parse(await readFile(resolve(here, './fixtures/B2-P2-F001-shell-parity.json'), 'utf8'));

async function repositoryFile(path) {
  return readFile(resolve(repositoryRoot, path), 'utf8');
}

test('Phase 2C route and permission registries are internally valid', () => {
  assert.deepEqual(validateRouteRegistry(), { valid: true, errors: [] });
  assert.deepEqual(validatePermissionRegistry(), { valid: true, errors: [] });
  assert.equal(ROUTES.length, 6);
});

test('Build 2 route labels, page ids, access, and defaults match the Build 1 parity fixture', () => {
  assert.deepEqual(ROUTES.map(({ id, label, pageId }) => ({ id, label, pageId })), fixture.routes);
  for (const [role, routeIds] of Object.entries(fixture.roles)) {
    assert.deepEqual(allowedRoutesForRole(role).map(route => route.id), routeIds);
    assert.equal(defaultRouteForRole(role).id, fixture.defaults[role]);
  }
});

test('unknown roles receive the least-privileged authenticated Build 1 fallback', () => {
  assert.equal(normalizeShellRole('unknown'), 'airman');
  assert.deepEqual(allowedRoutesForRole('unknown').map(route => route.id), ['board', 'processing']);
});

test('route access is centralized and role changes cannot retain a forbidden route', () => {
  assert.equal(canAccessRoute('instructor', 'archives'), true);
  assert.equal(canAccessRoute('airman', 'archives'), false);
  assert.equal(canAccessRoute('squadron', 'board'), false);

  const instructor = createShellState({ role: 'instructor', activeRoute: 'airport' });
  const airman = reduceShellState(instructor, { type: 'role.changed', role: 'airman' });
  assert.equal(airman.role, 'airman');
  assert.equal(airman.activeRoute, 'board');
  assert.deepEqual(validateShellState(airman), { valid: true, errors: [] });
});

test('denied route requests preserve the current allowed route and expose an access notice', () => {
  const initial = createShellState({ role: 'airman', activeRoute: 'board' });
  const denied = reduceShellState(initial, { type: 'route.requested', routeId: 'archives' });
  assert.equal(denied.activeRoute, 'board');
  assert.equal(denied.notice.kind, 'access-denied');
  assert.match(denied.notice.message, /Instructor access/i);
});

test('shell state transitions are deterministic and do not depend on the DOM or current time', () => {
  const initial = createShellState({ role: 'instructor', navigationMode: 'sheet', navigationOpen: false });
  const event = { type: 'persistence.changed', status: 'saving', message: 'Saving', updatedAt: '2026-07-15T18:00:00Z' };
  const first = reduceShellState(initial, event);
  const second = reduceShellState(initial, event);
  assert.deepEqual(first, second);
  assert.equal(first.persistence.updatedAt, '2026-07-15T18:00:00Z');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.persistence), true);
});

test('navigation overlay state is explicit and persistent navigation never becomes an overlay', () => {
  const persistent = createShellState({ navigationMode: 'persistent', navigationOpen: true });
  assert.equal(persistent.navigation.open, false);

  const sheet = reduceShellState(persistent, { type: 'navigation.modeChanged', mode: 'sheet' });
  const open = reduceShellState(sheet, { type: 'navigation.toggled' });
  assert.equal(open.navigation.mode, 'sheet');
  assert.equal(open.navigation.open, true);
  assert.deepEqual(validateShellState(open), { valid: true, errors: [] });
});

test('persistence states always have a visible announcement contract', () => {
  const expectations = {
    saving: 'Saving',
    saved: 'Saved',
    failed: 'Save failed. Retry required.',
    conflict: 'Conflict detected. Refresh or resolve before continuing.',
    stale: 'Data may be stale.'
  };
  for (const [status, message] of Object.entries(expectations)) {
    const state = createShellState({ persistenceStatus: status });
    assert.equal(selectPersistenceAnnouncement(state), message);
  }
});

test('shell store publishes validated state changes and ignores unknown events', () => {
  const store = createShellStore({ role: 'instructor', activeRoute: 'board' });
  const calls = [];
  const unsubscribe = store.subscribe((next, previous, event) => calls.push({ next, previous, event }));
  const unchanged = store.dispatch({ type: 'unknown.event' });
  assert.equal(unchanged, store.getState());
  assert.equal(calls.length, 0);
  store.dispatch({ type: 'route.requested', routeId: 'processing' });
  assert.equal(calls.length, 1);
  assert.equal(store.getState().activeRoute, 'processing');
  unsubscribe();
});

test('navigation models expose only permitted routes and one aria-current page', () => {
  const state = createShellState({ role: 'airman', activeRoute: 'processing' });
  const model = selectNavigationModel(state);
  assert.deepEqual(model.map(route => route.id), ['board', 'processing']);
  assert.deepEqual(model.filter(route => route.ariaCurrent === 'page').map(route => route.id), ['processing']);
});

test('shell renderers provide skip navigation, landmarks, current-route semantics, modal sheet structure, and escaping', () => {
  const state = createShellState({ role: 'airman', activeRoute: 'processing', navigationMode: 'sheet', navigationOpen: true, weekGroup: 'WG 26-01' });
  const navigation = renderGateNavigation(state);
  const shell = renderGateAppShell({ state, title: '<script>alert(1)</script>', content: '<section>Trusted component output</section>' });

  assert.match(shell, /href="#gate-shell-main"/);
  assert.match(shell, /<header class="gate-shell-header">/);
  assert.match(shell, /<main class="gate-shell-main"/);
  assert.match(shell, /aria-label="Active week group: WG 26-01"/);
  assert.doesNotMatch(shell, /<script/i);
  assert.match(shell, /&lt;script/);
  assert.match(navigation, /role="dialog"/);
  assert.match(navigation, /aria-modal="true"/);
  assert.match(navigation, /aria-current="page"/);
  assert.doesNotMatch(navigation, /data-gate-route="airport"/);
});

test('shell core has no DOM, API, repository, generic-record, or inline-handler dependency', async () => {
  const paths = [
    'public/app/shell/route-registry.mjs',
    'public/app/shell/permission-registry.mjs',
    'public/app/shell/shell-state.mjs',
    'public/app/shell/shell-store.mjs',
    'public/app/shell/selectors.mjs',
    'public/app/shell/renderers.mjs'
  ];
  const source = (await Promise.all(paths.map(repositoryFile))).join('\n');
  assert.doesNotMatch(source, /\b(?:document|window|localStorage|sessionStorage)\b/);
  assert.doesNotMatch(source, /fetch\s*\(|\/api\/records|generic record|Gate\w+Repository/);
  assert.doesNotMatch(source, /\son[a-z]+\s*=/i);
});

test('shell CSS uses GDL tokens and explicit presentations without device-specific page repair rules', async () => {
  const css = await repositoryFile('public/app/shell/gate-shell.css');
  assert.match(css, /var\(--gate-/);
  assert.match(css, /data-gate-navigation-mode/);
  assert.match(css, /@container/);
  assert.match(css, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla)\s*\(/i);
  assert.doesNotMatch(css, /#page-|\.page-board|\.page-processing|\.page-airport/i);
  assert.doesNotMatch(css, /iPhone|iPad|Android|navigator\.userAgent/i);
  assert.doesNotMatch(css, /@media\s*\(max-width/i);
});

test('shell workshop exercises role, route, theme, density, persistence, connectivity, and focus behavior', async () => {
  const source = await repositoryFile('public/app/shell/workshop/workshop.mjs');
  for (const eventType of ['role.changed', 'route.requested', 'theme.changed', 'density.changed', 'persistence.changed', 'connectivity.changed', 'navigation.toggled', 'navigation.closed']) {
    assert.match(source, new RegExp(eventType.replace('.', '\\.')));
  }
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.doesNotMatch(source, /navigator\.userAgent|iPhone|iPad|Android/i);
});

test('Build 1 middleware does not load Build 2 shell or shell-workshop assets', async () => {
  const middleware = await repositoryFile('functions/_middleware.js');
  assert.doesNotMatch(middleware, /\/app\/shell|shell\/workshop|gate-shell\.css/);
});
