import fs from 'node:fs/promises';

const read = p => fs.readFile(p, 'utf8');
const write = (p, s) => fs.writeFile(p, s);
const exists = async p => { try { await fs.access(p); return true; } catch { return false; } };
const assert = (v, m) => { if (!v) throw new Error(m); };

const indexPath = 'public/index.html';
const bootstrapPath = 'public/js/gate-application-bootstrap.js';
const statusPath = 'public/js/gate-status-board-controller.js';
const processingPath = 'public/js/gate-processing-controller.js';
const busPath = 'public/js/gate-bus-workflow-controller.js';
const inputPath = 'public/js/gate-input-page-controller.js';
const archivePath = 'public/js/gate-archive-controller.js';
const shellPath = 'public/js/gate-app-shell-controller.js';

let index = await read(indexPath);
let status = await read(statusPath);
let processing = await read(processingPath);
let bus = await read(busPath);
let input = await read(inputPath);
let archive = await read(archivePath);
let shell = await read(shellPath);

const storeTag = '<script src="/js/gate-application-store.js" defer></script>';
const routeTag = '<script src="/js/gate-route-lifecycle.js" defer></script>';
assert(index.includes(storeTag) && index.includes(routeTag), 'Canonical store/lifecycle are not loaded.');
assert(index.indexOf(storeTag) < index.indexOf('/js/gate-status-board-controller.js'), 'Store loads after route controllers.');
assert(index.indexOf(routeTag) < index.indexOf('/js/gate-status-board-controller.js'), 'Route lifecycle loads after route controllers.');
assert(index.indexOf(routeTag) < index.indexOf('/js/gate-application-bootstrap.js'), 'Route lifecycle loads after bootstrap.');

// Status Board: component contracts are mandatory; remove fallbacks and compatibility globals.
status = status.replace(/\n  function fallbackDormCard\([\s\S]*?\n  function renderDormCard/, '\n  function renderDormCard');
status = status.replace(/const html = components\(\)\?\.dormCard\s*\? components\(\)\.dormCard\(dorm, \{ showAuditorium: true \}\)\s*:\s*fallbackDormCard\(dorm\);/, "const html = components()?.dormCard?.(dorm, { showAuditorium: true });\n    if (!html) throw new Error('GateComponents.dormCard is required.');");
status = status.replace(/\n  function fallbackActiveBusCard\([\s\S]*?\n  function hasCompleteActiveBusMarkup/, '\n  function hasCompleteActiveBusMarkup');
status = status.replace(/container\.innerHTML = buses\s*\.map\(bus => components\(\)\?\.activeBusCard\s*\? components\(\)\.activeBusCard\(bus\)\.replace\('data-owner="gate-active-bus-controller"', 'data-owner="gate-status-board-controller"'\)\s*:\s*fallbackActiveBusCard\(bus\)\)\s*\.join\(''\);/, "container.innerHTML = buses.map(bus => {\n      const html = components()?.activeBusCard?.(bus);\n      if (!html) throw new Error('GateComponents.activeBusCard is required.');\n      return html.replace('data-owner=\"gate-active-bus-controller\"', 'data-owner=\"gate-status-board-controller\"');\n    }).join('');");
status = status.replace(/\n  function patchLegacyBoardGlobals\([\s\S]*?\n  function registerHooksOnce/, '\n  function registerHooksOnce');
status = status.replace(/\n\s*patchLegacyBoardGlobals\(\);/g, '\n');
status = status.replace(/\n  function ensureTimerOwner\(\) \{[\s\S]*?\n  \}/, `
  function ensureTimerOwner() {
    if (!canonicalTimerTimeout) restartTimerOwner();
    else canonicalTimerTick();
    return canonicalTimerTimeout;
  }`);
status = status.replace(/onclick="confirmBusArrival\(this\.dataset\.busId\)"/g, 'data-gate-bus-arrival="true"');

// Remove compatibility-global patch functions from canonical controllers.
processing = processing.replace(/\n  function patchGlobals\(\) \{[\s\S]*?\n  \}/, '\n');
processing = processing.replace(/\n\s*patchGlobals\(\);/g, '\n');
bus = bus.replace(/\n  function patchGlobals\(\) \{[\s\S]*?\n  \}/, '\n');
bus = bus.replace(/\n\s*patchGlobals\(\);/g, '\n');
input = input.replace(/\n  function patchGlobals\(\) \{[\s\S]*?\n  \}/, '\n');
input = input.replace(/\n\s*patchGlobals\(\);/g, '\n');

// Replace generated inline handlers with delegated data attributes.
processing = processing
  .replace(/onclick="openDormModal\('\$\{d\.__backendId\}'\)"/g, 'data-gate-open-dorm="${d.__backendId}"')
  .replace(/oncontextmenu="openDormEditModal\(event, '\$\{d\.__backendId\}'\)"/g, 'data-gate-edit-dorm="${d.__backendId}"');
bus = bus
  .replace(/onclick="openAirportBusEditModal\('\$\{bus\.__backendId\}'\)"/g, 'data-component="editable-bus-row" data-bus-id="${bus.__backendId}"')
  .replace(/onclick="confirmBusArrival\(this\.dataset\.busId\)"/g, 'data-gate-bus-arrival="true"');
archive = archive
  .replace(/button\.onclick = printCurrentSummaryReport;/g, '')
  .replace(/button\.onclick = printArchiveReport;/g, '')
  .replace(/button\[onclick="printArchiveSpreadsheet\(\)"\],\s*/g, '')
  .replace(/, #archive-edit-modal button\[onclick="printArchiveSpreadsheet\(\)"\]/g, '')
  .replace(/onclick="openArchiveEditModal\('\$\{archive\.__backendId\}'\)"/g, 'data-archive-id="${archive.__backendId}"');

// App shell: use canonical store/route lifecycle and remove compatibility globals/fallback route calls.
shell = shell
  .replace(/function role\(\) \{[\s\S]*?\n  \}/, "function role() { return window.GateApplicationStore?.session?.().role || 'airman'; }")
  .replace(/try \{ if \(!document\.getElementById\('page-squadron'\) && typeof renderAll === 'function'\) renderAll\(\); \} catch \(_\) \{\}/, '')
  .replace(/let wg = '';\n\s*try \{ wg = typeof getActiveWG === 'function' \? getActiveWG\(\) : ''; \} catch \(_\) \{ wg = ''; \}/, "const wg = window.GateApplicationStore?.activeWeekGroup?.() || '';")
  .replace(/\n  function patchGlobals\(\) \{[\s\S]*?\n  \}/, '\n')
  .replace(/\n\s*patchGlobals\(\);/g, '\n')
  .replace(/try \{ if \(typeof updateRoleVisibility === 'function'\) updateRoleVisibility\(\); \} catch \(_\) \{\}/, '')
  .replace(/window\.GateAppShell = Object\.freeze\(\{/, 'window.GateAppShell = Object.freeze({');

// Canonical bootstrap owns only session, data initialization, shell-level controls, and orchestration.
const bootstrap = `// Canonical GATE 3 application bootstrap: session, data, shell controls, and orchestration only.
(function () {
  'use strict';

  const store = window.GateApplicationStore;
  if (!store || !window.GateRouteLifecycle) throw new Error('GATE foundations must load before bootstrap.');

  const SOUND_ENABLED_KEY = 'prc_sr_sound_enabled_v1';
  const SOUND_FILES = Object.freeze({
    dorm_open: '/assets/sr_open_sound.mp3',
    dorm_closed: '/assets/sr_closed_sound.mp3',
    bus_dispatch: '/assets/sr_bus_sound.mp3',
    overtime: '/assets/sr_overtime_sound.mp3'
  });
  let soundEnabled = localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
  let isDark = true;

  function refreshOwners() {
    const display = document.getElementById('week-group-display');
    if (display) display.textContent = store.activeWeekGroup() || 'No WG';
    window.GateStatusBoardController?.scheduleRender?.({ force: true });
    window.GateProcessingController?.refresh?.();
    window.GateBusWorkflowController?.refresh?.();
    window.GateInputPageController?.refresh?.();
    window.GateArchiveController?.refresh?.();
    window.GatePremiumMetricsController?.refresh?.();
    window.GateAppShell?.sync?.();
    window.runGateHooks?.('afterDataChanged', { records: store.records() });
  }

  async function loadSession() {
    const response = await fetch('/api/session', { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
    const result = await response.json();
    if (!result.isOk) { window.location.href = '/login/'; return false; }
    store.setSession({ role: result.role || 'airman', username: result.username || '' });
    return true;
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST', headers: { Accept: 'application/json' } });
    window.location.href = '/login/';
  }

  function toggleTheme() {
    isDark = !isDark;
    document.body.classList.toggle('theme-light', !isDark);
  }

  async function toggleFullscreenBoard() {
    const board = document.getElementById('page-board');
    if (!board) return;
    if (!document.fullscreenElement) {
      await board.requestFullscreen?.();
      document.body.classList.add('fullscreen-board');
    } else {
      await document.exitFullscreen?.();
      document.body.classList.remove('fullscreen-board');
    }
    window.GateFullscreenBoardLayout?.sync?.();
  }

  async function enableOperationalSounds() {
    soundEnabled = true;
    localStorage.setItem(SOUND_ENABLED_KEY, 'true');
    const button = document.getElementById('sound-toggle-btn');
    if (button) button.textContent = 'SOUND ON';
    await Promise.all(Object.values(SOUND_FILES).map(async src => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = 0.01;
      try { await audio.play(); audio.pause(); audio.currentTime = 0; } catch (_) {}
    }));
  }

  function handleStaticAction(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-gate-action-click]') : null;
    if (!target) return;
    const id = target.dataset.gateActionClick;
    const actions = {
      'gate-action-001': logout,
      'gate-action-002': toggleFullscreenBoard,
      'gate-action-003': enableOperationalSounds,
      'gate-action-004': toggleTheme,
      'gate-action-006': () => window.GateInputPageController?.initializeWeekGroup?.(event),
      'gate-action-007': () => window.GateAppShell?.go?.('board'),
      'gate-action-009': () => window.GateArchiveController?.initiateCloseout?.(event),
      'gate-action-010': () => window.GateProcessingController?.closeDormModal?.(),
      'gate-action-019': () => window.GateProcessingController?.closeDormEditModal?.(),
      'gate-action-021': () => window.GateBusWorkflowController?.closeLocalBusModal?.(),
      'gate-action-022': () => window.GateBusWorkflowController?.closeBusModal?.(),
      'gate-action-023': () => window.GateArchiveController?.closeArchiveEditModal?.(),
      'gate-action-024': () => window.GateArchiveController?.printArchiveReport?.(event)
    };
    const action = actions[id];
    if (action) { event.preventDefault(); action(); }
  }

  function handleCanonicalActions(event) {
    const busArrival = event.target instanceof Element ? event.target.closest('[data-gate-bus-arrival][data-bus-id]') : null;
    if (busArrival) return window.GateBusWorkflowController?.confirmBusArrival?.(busArrival.dataset.busId);
    const dorm = event.target instanceof Element ? event.target.closest('[data-gate-open-dorm]') : null;
    if (dorm) return window.GateProcessingController?.openDormModal?.(dorm.dataset.gateOpenDorm);
    const archive = event.target instanceof Element ? event.target.closest('[data-archive-id]') : null;
    if (archive) return window.GateArchiveController?.openArchiveEditModal?.(event, archive.dataset.archiveId);
  }

  async function initializeData() {
    if (!window.dataSdk) throw new Error('Data SDK unavailable.');
    const result = await window.dataSdk.init({ onDataChanged(data) { store.replaceRecords(data, 'data-sdk'); refreshOwners(); } });
    if (!result?.isOk) console.warn('Data SDK initialized with a warning:', result);
  }

  async function init() {
    document.addEventListener('click', handleStaticAction, true);
    document.addEventListener('click', handleCanonicalActions, true);
    const sessionOk = await loadSession();
    if (!sessionOk) return;
    try { await initializeData(); } catch (error) { console.error('GATE failed to initialize data layer:', error); store.replaceRecords([], 'data-sdk-error'); }
    if (window.lucide) window.lucide.createIcons();
    const soundButton = document.getElementById('sound-toggle-btn');
    if (soundButton) soundButton.textContent = soundEnabled ? 'SOUND ON' : 'ENABLE SOUND';
    refreshOwners();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
`;

await write(statusPath, status);
await write(processingPath, processing);
await write(busPath, bus);
await write(inputPath, input);
await write(archivePath, archive);
await write(shellPath, shell);
await write(bootstrapPath, bootstrap);
await write(indexPath, index);

const staleWorkflows = [
  '.github/workflows/build-2-phase-3a-status-board-shadow.yml',
  '.github/workflows/build-2-phase-3a-evidence-harness.yml',
  '.github/workflows/build-2-phase-3a-evidence-review.yml',
  '.github/workflows/build-2-audit-remediation-gate-1.yml',
  '.github/workflows/consolidate-gate-route-owners.yml'
];
for (const path of staleWorkflows) if (await exists(path)) await fs.rm(path);

const retainedBootstrap = await read(bootstrapPath);
assert(!/function\s+(renderDormColumns|buildBoardDormCard|renderProcessingPage|buildProcCard|openDormModal|confirmBusArrival|initBatchGrid|renderArchives|initiateCloseout|updateTimers)\b/.test(retainedBootstrap), 'Duplicate route owner remains in bootstrap.');
assert(!/fallbackDormCard|fallbackActiveBusCard/.test(await read(statusPath)), 'Status Board fallback remains.');
for (const path of [statusPath, processingPath, busPath, inputPath, archivePath]) {
  const source = await read(path);
  assert(!/onclick="|oncontextmenu="/.test(source), `Inline handler generation remains in ${path}.`);
  assert(!/function patchGlobals\b/.test(source), `Compatibility globals remain in ${path}.`);
}
assert(!/function patchGlobals\b|window\.showPage|window\.buildNav/.test(await read(shellPath)), 'Shell compatibility globals remain.');
console.log('GATE UI/UX stabilization completed.');
