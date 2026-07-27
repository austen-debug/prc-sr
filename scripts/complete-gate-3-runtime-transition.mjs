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

const store = `// Canonical GATE 3 application state and selector boundary.\n(function () {\n  'use strict';\n  let records = [];\n  let session = Object.freeze({ role: 'airman', username: '' });\n  const listeners = new Set();\n  const snapshot = () => Object.freeze({ records: records.slice(), session });\n  const emit = source => listeners.forEach(listener => listener(snapshot(), source));\n  window.GateApplicationStore = Object.freeze({\n    records: () => records,\n    replaceRecords(next, source = 'replace-records') { records = Array.isArray(next) ? next : []; emit(source); },\n    upsert(record, source = 'upsert-record') {\n      if (!record) return;\n      const id = record.__backendId;\n      const index = id ? records.findIndex(item => item?.__backendId === id) : -1;\n      if (index >= 0) records[index] = { ...records[index], ...record }; else records.push(record);\n      emit(source);\n    },\n    remove(recordOrId, source = 'remove-record') {\n      const id = typeof recordOrId === 'string' ? recordOrId : recordOrId?.__backendId;\n      if (!id) return;\n      records = records.filter(item => item?.__backendId !== id); emit(source);\n    },\n    selectType(type) { return records.filter(record => record?.type === type); },\n    config(key) { return records.find(record => record?.type === 'config' && record.key === key)?.value || ''; },\n    activeWeekGroup() { return this.config('week_group'); },\n    setSession(next) { session = Object.freeze({ role: next?.role || 'airman', username: next?.username || '' }); emit('session'); },\n    session: () => session,\n    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }\n  });\n})();\n`;

const lifecycle = `// Canonical GATE 3 route lifecycle.\n(function () {\n  'use strict';\n  const routes = new Map();\n  let active = 'board';\n  function register(id, owner) { routes.set(id, owner); }\n  function activate(id) {\n    if (!routes.has(id)) return false;\n    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === 'page-' + id));\n    active = id;\n    window.runGateHooks?.('afterPageChange', { route: id, owner: routes.get(id) });\n    return true;\n  }\n  window.GateRouteLifecycle = Object.freeze({ register, activate, active: () => active, owner: id => routes.get(id) || '' });\n})();\n`;
await write('public/js/gate-application-store.js', store);
await write('public/js/gate-route-lifecycle.js', lifecycle);

if (!index.includes('/js/gate-application-store.js')) {
  index = index.replace('<script src="/js/gate-data-sdk.js" defer></script>', '<script src="/js/gate-application-store.js" defer></script>\n<script src="/js/gate-route-lifecycle.js" defer></script>\n<script src="/js/gate-data-sdk.js" defer></script>');
}

// Replace bootstrap global state with store/session boundaries.
bootstrap = bootstrap.replace(/\nlet allData = \[\];/, '\nconst GateStore = window.GateApplicationStore;');
bootstrap = bootstrap.replace(/\ballData = data;/g, 'GateStore.replaceRecords(data, \'data-sdk\');');
bootstrap = bootstrap.replace(/\ballData = \[\];/g, 'GateStore.replaceRecords([], \'data-sdk-error\');');
bootstrap = bootstrap.replace(/\ballData\.filter\(/g, 'GateStore.records().filter(');
bootstrap = bootstrap.replace(/\ballData\.find\(/g, 'GateStore.records().find(');
bootstrap = bootstrap.replace(/\ballData\.length/g, 'GateStore.records().length');
bootstrap = bootstrap.replace(/let currentRole = 'instructor';[\s\S]*?let currentUsername = '';/, '');
bootstrap = bootstrap.replace(/currentRole = result\.role \|\| 'airman';\s*currentUsername = result\.username \|\| '';/, "GateStore.setSession({ role: result.role || 'airman', username: result.username || '' });");
bootstrap = bootstrap.replace(/\bcurrentRole\b/g, "GateStore.session().role");
bootstrap = bootstrap.replace(/\bcurrentUsername\b/g, "GateStore.session().username");
bootstrap = bootstrap.replace(/function getRecords\(type\) \{[^}]+\}/, "function getRecords(type) { return GateStore.selectType(type); }");
bootstrap = bootstrap.replace(/function getConfig\(key\) \{[^}]+\}/, "function getConfig(key) { return GateStore.config(key); }");
bootstrap = bootstrap.replace(/function getActiveWG\(\) \{[^}]+\}/, "function getActiveWG() { return GateStore.activeWeekGroup(); }");
bootstrap = bootstrap.replace(/function showPage\(id\) \{[\s\S]*?\n\s*\}/, "function showPage(id) { if (GateRouteLifecycle.activate(id)) buildNav(); }");
bootstrap = bootstrap.replace(/function renderAll\(\) \{/g, 'function renderApplication() {');
bootstrap = bootstrap.replace(/\brenderAll\(\)/g, 'renderApplication()');
bootstrap = bootstrap.replace(/window\.renderAll/g, 'window.renderApplication');

for (const path of controllers) {
  let source = await read(path);
  source = source.replace(/try \{ return Array\.isArray\(allData\) \? allData : \[\]; \} catch \(_\) \{ return \[\]; \}/g, "return window.GateApplicationStore?.records?.() || [];");
  source = source.replace(/if \(Array\.isArray\(window\.allData\)\) return window\.allData;[\s\S]*?catch \(_\) \{ return \[\]; \}/g, "return window.GateApplicationStore?.records?.() || [];");
  source = source.replace(/try \{ return typeof getActiveWG === 'function' \? getActiveWG\(\) : ''; \} catch \(_\) \{ return ''; \}/g, "return window.GateApplicationStore?.activeWeekGroup?.() || '';");
  source = source.replace(/try \{ return typeof window\.getActiveWG === 'function' \? window\.getActiveWG\(\) : ''; \} catch \(_\) \{ return ''; \}/g, "return window.GateApplicationStore?.activeWeekGroup?.() || '';");
  source = source.replace(/try \{ return currentRole === 'instructor'; \} catch \(_\) \{ return false; \}/g, "return window.GateApplicationStore?.session?.().role === 'instructor';");
  source = source.replace(/if \(typeof renderAll === 'function'\) renderAll\(\);/g, "window.renderApplication?.();");
  source = source.replace(/window\.GateApplicationStore\?\.records\?\.\(\) \|\| \[\];/g, "window.GateApplicationStore?.records?.() || [];");
  if (path.endsWith('gate-archive-controller.js')) {
    source = source.replace(/\n  function patchGlobals\(\) \{[\s\S]*?\n  \}/, '\n');
    source = source.replace(/\n\s*patchGlobals\(\);/, '\n');
    source = source.replace(/window\.initiateCloseout =[^;]+;|window\.renderArchives =[^;]+;|window\.openArchiveEditModal =[^;]+;|window\.closeArchiveEditModal =[^;]+;|window\.printArchiveSpreadsheet =[^;]+;|window\.printCurrentSummaryReport =[^;]+;/g, '');
  }
  await write(path, source);
}

// Register canonical route owners.
bootstrap = bootstrap.replace(/buildNav\(\);\s*updateSoundButton\(\);/, `GateRouteLifecycle.register('board', 'gate-status-board-controller');\nGateRouteLifecycle.register('airport', 'gate-bus-workflow-controller');\nGateRouteLifecycle.register('input', 'gate-input-page-controller');\nGateRouteLifecycle.register('processing', 'gate-processing-controller');\nGateRouteLifecycle.register('archives', 'gate-archive-controller');\nbuildNav();\nupdateSoundButton();`);

// Archive: remove legacy archive functions from bootstrap.
for (const name of ['renderArchives','initiateCloseout','openArchiveEditModal','closeArchiveEditModal','printArchiveSpreadsheet']) {
  const re = new RegExp(`\\n(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`, 'g');
  bootstrap = bootstrap.replace(re, '\n');
}

await write(bootstrapPath, bootstrap);

// Fold corrective CSS into permanent design-system owners.
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
    const file = sourcePath.split('/').pop().replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    index = index.replace(new RegExp(`\\s*<link[^>]+href="[^"]*${file}[^"]*"[^>]*>\\s*`, 'g'), '\n');
    await fs.rm(sourcePath);
  }
  await write(target, content);
}

// Remove obsolete scripts and orphaned shadow runtime.
const obsoleteScripts = [
  'prc-dash-runtime-fixes.js','prc-dash-dorm-reopen.js','prc-dash-final-audit.js',
  'prc-dash-dorm-flag-validation.js','prc-dash-auditorium-location.js',
  'gate-airport-bus-delete-controller.js','prc-dash-modal-mobile-validation.js',
  'gate-render-stability-fix.js','prc-dash-processing-loaded-summary.js',
  'prc-dash-overtime-audit.js','prc-dash-sat-arrivals.js'
];
for (const name of obsoleteScripts) {
  index = index.replace(new RegExp(`\\s*<script[^>]+src="[^"]*${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}[^"]*"[^>]*><\\/script>\\s*`, 'g'), '\n');
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
