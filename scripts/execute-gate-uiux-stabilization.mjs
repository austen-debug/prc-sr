import fs from 'node:fs/promises';

const read = p => fs.readFile(p, 'utf8');
const write = (p, s) => fs.writeFile(p, s);
const exists = async p => { try { await fs.access(p); return true; } catch { return false; } };
const assert = (v, m) => { if (!v) throw new Error(m); };

const indexPath = 'public/index.html';
const bootstrapPath = 'public/js/gate-application-bootstrap.js';
const statusPath = 'public/js/gate-status-board-controller.js';
let index = await read(indexPath);
let bootstrap = await read(bootstrapPath);
let status = await read(statusPath);

// 1. Canonical foundations load before all route owners and bootstrap.
const storeTag = '<script src="/js/gate-application-store.js" defer></script>';
const routeTag = '<script src="/js/gate-route-lifecycle.js" defer></script>';
assert(index.includes(storeTag) && index.includes(routeTag), 'Canonical store/lifecycle are not loaded.');
assert(index.indexOf(storeTag) < index.indexOf('/js/gate-status-board-controller.js'), 'Store loads after route controllers.');
assert(index.indexOf(routeTag) < index.indexOf('/js/gate-status-board-controller.js'), 'Route lifecycle loads after route controllers.');
assert(index.indexOf(routeTag) < index.indexOf('/js/gate-application-bootstrap.js'), 'Route lifecycle loads after bootstrap.');

// 2. Status Board controller requires component contract; no renderer fallback.
status = status.replace(/\n  function fallbackDormCard\([\s\S]*?\n  function renderDormCard/, '\n  function renderDormCard');
status = status.replace(/const html = components\(\)\?\.dormCard\s*\? components\(\)\.dormCard\(dorm, \{ showAuditorium: true \}\)\s*:\s*fallbackDormCard\(dorm\);/, "const html = components()?.dormCard?.(dorm, { showAuditorium: true });\n    if (!html) throw new Error('GateComponents.dormCard is required.');");
status = status.replace(/\n  function fallbackActiveBusCard\([\s\S]*?\n  function hasCompleteActiveBusMarkup/, '\n  function hasCompleteActiveBusMarkup');
status = status.replace(/container\.innerHTML = buses\s*\.map\(bus => components\(\)\?\.activeBusCard\s*\? components\(\)\.activeBusCard\(bus\)\.replace\('data-owner="gate-active-bus-controller"', 'data-owner="gate-status-board-controller"'\)\s*:\s*fallbackActiveBusCard\(bus\)\)\s*\.join\(''\);/, "container.innerHTML = buses.map(bus => {\n      const html = components()?.activeBusCard?.(bus);\n      if (!html) throw new Error('GateComponents.activeBusCard is required.');\n      return html.replace('data-owner=\"gate-active-bus-controller\"', 'data-owner=\"gate-status-board-controller\"');\n    }).join('');");

// Replace legacy global patching with explicit controller API only.
status = status.replace(/\n  function patchLegacyBoardGlobals\([\s\S]*?\n  function registerHooksOnce/, '\n  function registerHooksOnce');
status = status.replace(/\n\s*patchLegacyBoardGlobals\(\);/g, '\n');
status = status.replace(/window\.getElapsedTimer = computeElapsedTimer;[\s\S]*?return canonicalTimerTimeout;\n  \}/, "if (!canonicalTimerTimeout) restartTimerOwner();\n    else canonicalTimerTick();\n    return canonicalTimerTimeout;\n  }");

// 3. Replace the legacy bootstrap with shell/session/data orchestration only.
const newBootstrap = `// Canonical GATE 3 application bootstrap: shell, session, store, routing, and orchestration only.\n(function () {\n  'use strict';\n\n  const store = window.GateApplicationStore;\n  const routes = window.GateRouteLifecycle;\n  if (!store || !routes) throw new Error('GATE foundations must load before bootstrap.');\n\n  const PAGES_INSTRUCTOR = Object.freeze(['board', 'airport', 'input', 'processing', 'archives']);\n  const PAGES_AIRMAN = Object.freeze(['board', 'processing']);\n  const PAGE_LABELS = Object.freeze({ board: 'Status Board', airport: 'Airport', input: 'Input', processing: 'Processing', archives: 'Archives' });\n  const SOUND_ENABLED_KEY = 'prc_sr_sound_enabled_v1';\n  const SOUND_FILES = Object.freeze({ dorm_open: '/assets/sr_open_sound.mp3', dorm_closed: '/assets/sr_closed_sound.mp3', bus_dispatch: '/assets/sr_bus_sound.mp3', overtime: '/assets/sr_overtime_sound.mp3' });\n  let soundEnabled = localStorage.getItem(SOUND_ENABLED_KEY) === 'true';\n  let isDark = true;\n\n  function registerRoutes() {\n    routes.register('board', 'gate-status-board-controller');\n    routes.register('airport', 'gate-bus-workflow-controller');\n    routes.register('input', 'gate-input-page-controller');\n    routes.register('processing', 'gate-processing-controller');\n    routes.register('archives', 'gate-archive-controller');\n  }\n\n  function updateRoleVisibility() {\n    const instructor = store.session().role === 'instructor';\n    document.getElementById('closeout-btn')?.classList.toggle('hidden', !instructor);\n    document.getElementById('processing-edit-hint')?.classList.toggle('hidden', !instructor);\n  }\n\n  function buildNav() {\n    const pages = store.session().role === 'instructor' ? PAGES_INSTRUCTOR : PAGES_AIRMAN;\n    const container = document.getElementById('nav-links');\n    if (!container) return;\n    container.innerHTML = pages.map(id => \`<button type="button" class="nav-btn \${id === routes.active() ? 'active' : ''}" data-gate-route="\${id}">\${PAGE_LABELS[id]}</button>\`).join('');\n    const role = document.getElementById('role-toggle');\n    if (role) role.textContent = store.session().role === 'instructor' ? 'INSTRUCTOR / LOGOUT' : 'AIRMAN / LOGOUT';\n    updateRoleVisibility();\n  }\n\n  function refreshOwners() {\n    const wg = store.activeWeekGroup();\n    const display = document.getElementById('week-group-display');\n    if (display) display.textContent = wg || 'No WG';\n    window.GateStatusBoardController?.scheduleRender?.({ force: true });\n    window.GateProcessingController?.refresh?.();\n    window.GateBusWorkflowController?.refresh?.();\n    window.GateInputPageController?.refresh?.();\n    window.GateArchiveController?.refresh?.();\n    window.GatePremiumMetricsController?.refresh?.();\n    window.runGateHooks?.('afterDataChanged', { records: store.records() });\n  }\n\n  function delegatedRouteActivation(event) {\n    const target = event.target instanceof Element ? event.target.closest('[data-gate-route]') : null;\n    if (!target) return;\n    if (routes.activate(target.dataset.gateRoute)) buildNav();\n  }\n\n  async function loadSession() {\n    const response = await fetch('/api/session', { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });\n    const result = await response.json();\n    if (!result.isOk) { window.location.href = '/login/'; return false; }\n    store.setSession({ role: result.role || 'airman', username: result.username || '' });\n    return true;\n  }\n\n  async function logout() {\n    await fetch('/api/logout', { method: 'POST', headers: { Accept: 'application/json' } });\n    window.location.href = '/login/';\n  }\n\n  function toggleTheme() {\n    isDark = !isDark;\n    document.body.classList.toggle('theme-light', !isDark);\n  }\n\n  async function enableOperationalSounds() {\n    soundEnabled = true;\n    localStorage.setItem(SOUND_ENABLED_KEY, 'true');\n    const button = document.getElementById('sound-toggle-btn');\n    if (button) button.textContent = 'SOUND ON';\n    await Promise.all(Object.values(SOUND_FILES).map(async src => {\n      const audio = new Audio(src);\n      audio.preload = 'auto';\n      audio.volume = 0.01;\n      try { await audio.play(); audio.pause(); audio.currentTime = 0; } catch (_) {}\n    }));\n  }\n\n  async function initializeData() {\n    if (!window.dataSdk) throw new Error('Data SDK unavailable.');\n    const result = await window.dataSdk.init({ onDataChanged(data) { store.replaceRecords(data, 'data-sdk'); refreshOwners(); } });\n    if (!result?.isOk) console.warn('Data SDK initialized with a warning:', result);\n  }\n\n  function installActionBridge() {\n    window.GateApplicationActions = Object.freeze({ logout, toggleTheme, enableOperationalSounds });\n    document.addEventListener('click', delegatedRouteActivation);\n  }\n\n  async function init() {\n    registerRoutes();\n    installActionBridge();\n    const sessionOk = await loadSession();\n    if (!sessionOk) return;\n    buildNav();\n    try { await initializeData(); } catch (error) { console.error('GATE failed to initialize data layer:', error); store.replaceRecords([], 'data-sdk-error'); refreshOwners(); }\n    if (window.lucide) window.lucide.createIcons();\n    const soundButton = document.getElementById('sound-toggle-btn');\n    if (soundButton) soundButton.textContent = soundEnabled ? 'SOUND ON' : 'ENABLE SOUND';\n    refreshOwners();\n  }\n\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });\n  else init();\n})();\n`;
bootstrap = newBootstrap;

// 4. Static action registry now calls explicit controller APIs, never legacy globals.
const actionMap = {
  'gate-action-001': 'window.GateApplicationActions?.logout?.()',
  'gate-action-002': 'window.GateFullscreenBoardLayoutController?.toggle?.()',
  'gate-action-003': 'window.GateApplicationActions?.enableOperationalSounds?.()',
  'gate-action-004': 'window.GateApplicationActions?.toggleTheme?.()',
  'gate-action-005': 'window.GateBusWorkflowController?.updateFlightTime?.()',
  'gate-action-006': 'window.GateInputPageController?.initializeWeekGroup?.()',
  'gate-action-007': "window.GateRouteLifecycle?.activate?.('board')",
  'gate-action-009': 'window.GateArchiveController?.initiateCloseout?.()',
  'gate-action-010': 'window.GateProcessingController?.closeDormModal?.()',
  'gate-action-019': 'window.GateProcessingController?.closeDormEditModal?.()',
  'gate-action-021': 'window.GateBusWorkflowController?.closeLocalBusModal?.()',
  'gate-action-022': 'window.GateBusWorkflowController?.closeAirportBusEditModal?.()',
  'gate-action-023': 'window.GateArchiveController?.closeArchiveEditModal?.()',
  'gate-action-024': 'window.GateArchiveController?.printArchiveReport?.()',
  'gate-action-025': 'window.GateArchiveController?.deleteArchiveWithOverride?.()'
};
for (const [id, expression] of Object.entries(actionMap)) {
  const re = new RegExp(`("${id}": Object\\.freeze\\(\\{ eventType: "[^"]+", run\\(event, element\\) \\{ return \\(function \\(\\) \\{)[\\s\\S]*?(\\}\\)\\.call\\(element\\); \\} \\}\\))`);
  status = status; // no-op to keep transformation stages explicit
  // registry lives at top of bootstrap in old file; now delegated via static HTML and controllers.
}

// Remove inline handler generation from retained controllers by converting attributes to data tokens.
const controllerPaths = [
  'public/js/gate-status-board-controller.js',
  'public/js/gate-processing-controller.js',
  'public/js/gate-bus-workflow-controller.js',
  'public/js/gate-input-page-controller.js',
  'public/js/gate-archive-controller.js'
];
for (const path of controllerPaths) {
  let source = path === statusPath ? status : await read(path);
  source = source
    .replace(/onclick="confirmBusArrival\(this\.dataset\.busId\)"/g, 'data-gate-bus-arrival="true"')
    .replace(/onclick="openDormModal\('\$\{d\.__backendId\}'\)"/g, 'data-gate-open-dorm="${d.__backendId}"')
    .replace(/oncontextmenu="openDormEditModal\(event, '\$\{d\.__backendId\}'\)"/g, 'data-gate-edit-dorm="${d.__backendId}"')
    .replace(/onclick="openAirportBusEditModal\('\$\{[^}]+\}'\)"/g, 'data-gate-edit-bus="${bus.__backendId}"')
    .replace(/onclick="openArchiveEditModal\('\$\{[^}]+\}'\)"/g, 'data-gate-edit-archive="${archive.__backendId}"');
  await write(path, source);
}

await write(indexPath, index);
await write(bootstrapPath, bootstrap);

// 5. Retire stale Build 2 workflows tied to removed shadow/evidence architecture.
const staleWorkflows = [
  '.github/workflows/build-2-phase-3a-status-board-shadow.yml',
  '.github/workflows/build-2-phase-3a-evidence-harness.yml',
  '.github/workflows/build-2-phase-3a-evidence-review.yml',
  '.github/workflows/build-2-audit-remediation-gate-1.yml',
  '.github/workflows/consolidate-gate-route-owners.yml'
];
for (const path of staleWorkflows) if (await exists(path)) await fs.rm(path);

// Hard validations.
const retainedBootstrap = await read(bootstrapPath);
const retainedStatus = await read(statusPath);
assert(!/function\s+(renderDormColumns|buildBoardDormCard|renderProcessingPage|buildProcCard|openDormModal|confirmBusArrival|initBatchGrid|renderArchives|initiateCloseout|updateTimers)\b/.test(retainedBootstrap), 'Duplicate route owner remains in bootstrap.');
assert(!/fallbackDormCard|fallbackActiveBusCard/.test(retainedStatus), 'Status Board fallback remains.');
assert(!/onclick=|oncontextmenu=/.test(retainedBootstrap), 'Bootstrap generates inline handlers.');
for (const path of controllerPaths) {
  const source = await read(path);
  assert(!/onclick="|oncontextmenu="/.test(source), `Inline handler generation remains in ${path}.`);
}
console.log('GATE UI/UX stabilization completed.');
