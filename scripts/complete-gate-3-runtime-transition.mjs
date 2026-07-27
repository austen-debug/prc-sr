import fs from 'node:fs/promises';

const read = p => fs.readFile(p, 'utf8');
const write = (p, s) => fs.writeFile(p, s);
const exists = async p => { try { await fs.access(p); return true; } catch { return false; } };
const assert = (v, m) => { if (!v) throw new Error(m); };

const indexPath = 'public/index.html';
const bootstrapPath = 'public/js/gate-application-bootstrap.js';
const controllers = [
  'public/js/gate-status-board-controller.js',
  'public/js/gate-processing-controller.js',
  'public/js/gate-bus-workflow-controller.js',
  'public/js/gate-input-page-controller.js',
  'public/js/gate-archive-controller.js'
];

let index = await read(indexPath);
let bootstrap = await read(bootstrapPath);

const store = `// Canonical GATE 3 application state and selector boundary.
(function () {
  'use strict';
  let records = [];
  let session = Object.freeze({ role: 'airman', username: '' });
  const listeners = new Set();
  const snapshot = () => Object.freeze({ records: records.slice(), session });
  const emit = source => listeners.forEach(listener => listener(snapshot(), source));
  window.GateApplicationStore = Object.freeze({
    records: () => records,
    replaceRecords(next, source = 'replace-records') { records = Array.isArray(next) ? next : []; emit(source); },
    upsert(record, source = 'upsert-record') {
      if (!record) return;
      const id = record.__backendId;
      const index = id ? records.findIndex(item => item?.__backendId === id) : -1;
      if (index >= 0) records[index] = { ...records[index], ...record }; else records.push(record);
      emit(source);
    },
    remove(recordOrId, source = 'remove-record') {
      const id = typeof recordOrId === 'string' ? recordOrId : recordOrId?.__backendId;
      if (!id) return;
      records = records.filter(item => item?.__backendId !== id); emit(source);
    },
    selectType(type) { return records.filter(record => record?.type === type); },
    config(key) { return records.find(record => record?.type === 'config' && record.key === key)?.value || ''; },
    activeWeekGroup() { return this.config('week_group'); },
    setSession(next) { session = Object.freeze({ role: next?.role || 'airman', username: next?.username || '' }); emit('session'); },
    session: () => session,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  });
})();
`;

const lifecycle = `// Canonical GATE 3 route lifecycle.
(function () {
  'use strict';
  const routes = new Map();
  let active = 'board';
  function register(id, owner) { routes.set(id, owner); }
  function activate(id) {
    if (!routes.has(id)) return false;
    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === 'page-' + id));
    active = id;
    window.runGateHooks?.('afterPageChange', { route: id, owner: routes.get(id) });
    return true;
  }
  window.GateRouteLifecycle = Object.freeze({ register, activate, active: () => active, owner: id => routes.get(id) || '' });
})();
`;

await write('public/js/gate-application-store.js', store);
await write('public/js/gate-route-lifecycle.js', lifecycle);

if (!index.includes('/js/gate-application-store.js')) {
  index = index.replace('<script src="/js/gate-data-sdk.js" defer></script>', '<script src="/js/gate-application-store.js" defer></script>\n<script src="/js/gate-route-lifecycle.js" defer></script>\n<script src="/js/gate-data-sdk.js" defer></script>');
}

bootstrap = bootstrap.replace(/\nlet allData = \[\];/, '\nconst GateStore = window.GateApplicationStore;');
bootstrap = bootstrap.replace(/\ballData = data;/g, "GateStore.replaceRecords(data, 'data-sdk');");
bootstrap = bootstrap.replace(/\ballData = \[\];/g, "GateStore.replaceRecords([], 'data-sdk-error');");
bootstrap = bootstrap.replace(/\ballData\.filter\(/g, 'GateStore.records().filter(');
bootstrap = bootstrap.replace(/\ballData\.find\(/g, 'GateStore.records().find(');
bootstrap = bootstrap.replace(/\ballData\.length/g, 'GateStore.records().length');
bootstrap = bootstrap.replace(/let currentRole = 'instructor';[\s\S]*?let currentUsername = '';/, '');
bootstrap = bootstrap.replace(/currentRole = result\.role \|\| 'airman';\s*currentUsername = result\.username \|\| '';/, "GateStore.setSession({ role: result.role || 'airman', username: result.username || '' });");
bootstrap = bootstrap.replace(/\bcurrentRole\b/g, 'GateStore.session().role');
bootstrap = bootstrap.replace(/\bcurrentUsername\b/g, 'GateStore.session().username');
bootstrap = bootstrap.replace(/function getRecords\(type\) \{[^}]+\}/, 'function getRecords(type) { return GateStore.selectType(type); }');
bootstrap = bootstrap.replace(/function getConfig\(key\) \{[^}]+\}/, 'function getConfig(key) { return GateStore.config(key); }');
bootstrap = bootstrap.replace(/function getActiveWG\(\) \{[^}]+\}/, 'function getActiveWG() { return GateStore.activeWeekGroup(); }');
bootstrap = bootstrap.replace(/function renderAll\(\) \{/g, 'function renderApplication() {');
bootstrap = bootstrap.replace(/\brenderAll\(\)/g, 'renderApplication()');
bootstrap = bootstrap.replace(/window\.renderAll/g, 'window.renderApplication');

bootstrap = bootstrap.replace(/function buildNav\(\) \{[\s\S]*?\n\s*\}/, `function buildNav() {
  const pages = GateStore.session().role === 'instructor' ? PAGES_INSTRUCTOR : PAGES_AIRMAN;
  const container = document.getElementById('nav-links');
  const activeId = GateRouteLifecycle.active();
  container.innerHTML = pages.map(id => \`<button type="button" class="nav-btn \${id === activeId ? 'active' : ''}" data-gate-route="\${id}">\${PAGE_LABELS[id]}<\/button>\`).join('');
  document.getElementById('role-toggle').textContent = GateStore.session().role === 'instructor' ? 'INSTRUCTOR / LOGOUT' : 'AIRMAN / LOGOUT';
  updateRoleVisibility();
}`);

bootstrap = bootstrap.replace(/\s*function showPage\(id\) \{[\s\S]*?\n\s*\}/, '\n');
bootstrap = bootstrap.replace(/const handler = \{/, `document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('[data-gate-route]') : null;
  if (!target) return;
  if (GateRouteLifecycle.activate(target.dataset.gateRoute)) buildNav();
});

const handler = {`);

for (const path of controllers) {
  let source = await read(path);
  source = source.replace(/try \{ return Array\.isArray\(allData\) \? allData : \[\]; \} catch \(_\) \{ return \[\]; \}/g, 'return window.GateApplicationStore?.records?.() || [];');
  source = source.replace(/if \(Array\.isArray\(window\.allData\)\) return window\.allData;[\s\S]*?catch \(_\) \{ return \[\]; \}/g, 'return window.GateApplicationStore?.records?.() || [];');
  source = source.replace(/try \{ return typeof getActiveWG === 'function' \? getActiveWG\(\) : ''; \} catch \(_\) \{ return ''; \}/g, "return window.GateApplicationStore?.activeWeekGroup?.() || '';");
  source = source.replace(/try \{ return typeof window\.getActiveWG === 'function' \? window\.getActiveWG\(\) : ''; \} catch \(_\) \{ return ''; \}/g, "return window.GateApplicationStore?.activeWeekGroup?.() || '';");
  source = source.replace(/try \{ return currentRole === 'instructor'; \} catch \(_\) \{ return false; \}/g, "return window.GateApplicationStore?.session?.().role === 'instructor';");
  source = source.replace(/if \(typeof renderAll === 'function'\) renderAll\(\);/g, 'window.renderApplication?.();');
  if (path.endsWith('gate-archive-controller.js')) {
    source = source.replace(/\n  function patchGlobals\(\) \{[\s\S]*?\n  \}/, '\n');
    source = source.replace(/\n\s*patchGlobals\(\);/, '\n');
    source = source.replace(/window\.initiateCloseout =[^;]+;|window\.renderArchives =[^;]+;|window\.openArchiveEditModal =[^;]+;|window\.closeArchiveEditModal =[^;]+;|window\.printArchiveSpreadsheet =[^;]+;|window\.printCurrentSummaryReport =[^;]+;/g, '');
  }
  await write(path, source);
}

bootstrap = bootstrap.replace(/buildNav\(\);\s*updateSoundButton\(\);/, `GateRouteLifecycle.register('board', 'gate-status-board-controller');
GateRouteLifecycle.register('airport', 'gate-bus-workflow-controller');
GateRouteLifecycle.register('input', 'gate-input-page-controller');
GateRouteLifecycle.register('processing', 'gate-processing-controller');
GateRouteLifecycle.register('archives', 'gate-archive-controller');
buildNav();
updateSoundButton();`);

for (const name of ['renderArchives','initiateCloseout','openArchiveEditModal','closeArchiveEditModal','printArchiveSpreadsheet']) {
  const re = new RegExp(`\\n(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`, 'g');
  bootstrap = bootstrap.replace(re, '\n');
}

await write(bootstrapPath, bootstrap);

const mergeTargets = {
  'public/css/gate-components.css': [
    'public/css/gate-ui-ownership-correction.css',
    'public/css/gate-light-mode-command-contrast.css',
    'public/css/gate-light-mode-grid-correction.css'
  ],
  'public/css/gate-layout-pages.css': [
    'public/css/gate-mobile-corrective.css',
    'public/css/gate-tablet-shell.css',
    'public/css/gate-fullscreen-board-contract.css'
  ]
};

for (const [target, sources] of Object.entries(mergeTargets)) {
  let content = await read(target);
  for (const sourcePath of sources) {
    if (!(await exists(sourcePath))) continue;
    const css = await read(sourcePath);
    content += `\n\n/* Consolidated from ${sourcePath} into permanent GATE 3 owner. */\n${css}\n`;
    const file = sourcePath.split('/').pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    index = index.replace(new RegExp(`\\s*<link[^>]+href="[^"]*${file}[^"]*"[^>]*>\\s*`, 'g'), '\n');
    await fs.rm(sourcePath);
  }
  await write(target, content);
}

const obsoleteScripts = [
  'prc-dash-runtime-fixes.js','prc-dash-dorm-reopen.js','prc-dash-final-audit.js',
  'prc-dash-dorm-flag-validation.js','prc-dash-auditorium-location.js',
  'gate-airport-bus-delete-controller.js','prc-dash-modal-mobile-validation.js',
  'gate-render-stability-fix.js','prc-dash-processing-loaded-summary.js',
  'prc-dash-overtime-audit.js','prc-dash-sat-arrivals.js'
];

for (const name of obsoleteScripts) {
  index = index.replace(new RegExp(`\\s*<script[^>]+src="[^"]*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[^>]*><\\/script>\\s*`, 'g'), '\n');
  const path = `public/js/${name}`;
  if (await exists(path)) await fs.rm(path);
}

if (await exists('public/js/gate-status-board-shadow-controller.js')) await fs.rm('public/js/gate-status-board-shadow-controller.js');
if (await exists('public/app/status-board-shadow')) await fs.rm('public/app/status-board-shadow', { recursive: true, force: true });

await write(indexPath, index);

assert(!/\blet allData\b|\bfunction renderAll\b|\bfunction showPage\b/.test(bootstrap), 'Legacy global state/render/router owner remains.');
assert(!/patchGlobals\(\)/.test(await read('public/js/gate-archive-controller.js')), 'Archive compatibility global patch remains.');
assert(!/corrective\.css|ui-ownership-correction|light-mode-command-contrast|light-mode-grid-correction|tablet-shell\.css|fullscreen-board-contract/.test(index), 'Corrective CSS link remains active.');
assert(!obsoleteScripts.some(name => index.includes(name)), 'Obsolete script remains active.');
console.log('GATE 3 runtime transition completed.');
