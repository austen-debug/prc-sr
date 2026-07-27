import fs from 'node:fs/promises';

const BRANCH_FILES = {
  index: 'public/index.html',
  bootstrap: 'public/js/gate-application-bootstrap.js',
  status: 'public/js/gate-status-board-controller.js',
  processing: 'public/js/gate-processing-controller.js',
  bus: 'public/js/gate-bus-workflow-controller.js',
  input: 'public/js/gate-input-page-controller.js'
};

const read = path => fs.readFile(path, 'utf8');
const write = (path, content) => fs.writeFile(path, content);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function removeScript(html, srcFragment) {
  return html.replace(new RegExp(`\\s*<script[^>]+src="[^"]*${srcFragment.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}[^"]*"[^>]*><\\/script>\\s*`, 'g'), '\n');
}

function removeFunction(source, name) {
  const pattern = new RegExp(`\\n(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`, 'g');
  return source.replace(pattern, '\n');
}

function exposeControllerApi(source, marker, additions) {
  assert(source.includes(marker), `Missing controller export marker: ${marker}`);
  return source.replace(marker, `${additions}\n${marker}`);
}

let index = await read(BRANCH_FILES.index);
let bootstrap = await read(BRANCH_FILES.bootstrap);
let status = await read(BRANCH_FILES.status);
let processing = await read(BRANCH_FILES.processing);
let bus = await read(BRANCH_FILES.bus);
let input = await read(BRANCH_FILES.input);

// Status Board: remove fallback rendering paths and legacy bootstrap owners.
status = status.replace(/\n  function fallbackDormCard\([\s\S]*?\n  function renderDormCard/, '\n  function renderDormCard');
status = status.replace(/const html = components\(\)\?\.dormCard\s*\? components\(\)\.dormCard\(dorm, \{ showAuditorium: true \}\)\s*:\s*fallbackDormCard\(dorm\);/, "const html = components()?.dormCard?.(dorm, { showAuditorium: true });\n    if (!html) throw new Error('GateComponents.dormCard is required by the canonical Status Board owner.');");
status = status.replace(/\n  function fallbackActiveBusCard\([\s\S]*?\n  function hasCompleteActiveBusMarkup/, '\n  function hasCompleteActiveBusMarkup');
status = status.replace(/container\.innerHTML = buses\s*\.map\(bus => components\(\)\?\.activeBusCard\s*\? components\(\)\.activeBusCard\(bus\)\.replace\([^\n]+\)\s*:[\s\S]*?\)\.join\(''\);/, "container.innerHTML = buses.map(bus => {\n      const html = components()?.activeBusCard?.(bus);\n      if (!html) throw new Error('GateComponents.activeBusCard is required by the canonical Status Board owner.');\n      return html.replace('data-owner=\"gate-active-bus-controller\"', 'data-owner=\"gate-status-board-controller\"');\n    }).join('');");
for (const fn of ['renderDormColumns','updateTimers','updateAirportMetric']) bootstrap = removeFunction(bootstrap, fn);
bootstrap = bootstrap.replace(/\n\s*const abEl = document\.getElementById\('active-buses'\);[\s\S]*?renderDormColumns\(dorms\);/, "\n      window.GateStatusBoardController?.scheduleRender?.({ force: true });");
bootstrap = bootstrap.replace(/\n\s*timerInterval = setInterval\(updateTimers, 1000\);/, '\n');

// Processing: absorb auxiliary behavior and retire delegate scripts.
for (const script of ['prc-dash-dorm-reopen.js','prc-dash-auditorium-location.js','prc-dash-processing-loaded-summary.js']) index = removeScript(index, script);
processing = exposeControllerApi(processing, '  window.GateProcessingController = Object.freeze({', `
  function setAuditoriumLocation(value) {
    const id = activeModalDormId();
    const dorm = dormById(id);
    if (!dorm) return Promise.resolve({ isOk: false, error: 'Dorm not found.' });
    return updateDorm({ ...dorm, auditorium_location: normalizeUpper(value) }, 'auditorium-location');
  }

  function loadedSummary() {
    return processingDorms().reduce((summary, dorm) => {
      const load = n(dorm.current_load);
      summary.total += load;
      if (String(dorm.state || '').toLowerCase() === 'closed') summary.closed += load;
      else summary.active += load;
      return summary;
    }, { total: 0, active: 0, closed: 0 });
  }
`);
processing = processing.replace('  window.GateProcessingController = Object.freeze({', '  window.GateProcessingController = Object.freeze({\n    setAuditoriumLocation,\n    loadedSummary,');

// Airport/bus: retire delegate scripts and expose complete canonical owner.
for (const script of ['prc-dash-sat-arrivals.js','gate-airport-bus-delete-controller.js']) index = removeScript(index, script);
for (const fn of ['getNextAirportBusId','confirmBusArrival','openLocalBusModal','closeLocalBusModal']) bootstrap = removeFunction(bootstrap, fn);
bus = bus.replace('  window.GateBusWorkflowController = Object.freeze({', '  window.GateBusWorkflowController = Object.freeze({\n    busById,\n    buses,');

// Input: remove legacy initialization/grid ownership from bootstrap.
for (const fn of ['initBatchGrid','initializeWeekGroup','returnToBoard']) bootstrap = removeFunction(bootstrap, fn);
bootstrap = bootstrap.replace(/\n\s*initBatchGrid\(\);/, '\n');

// Remove any remaining direct route rendering fallback calls from bootstrap.
bootstrap = bootstrap.replace(/if \(window\.GateStatusBoardController\?\.renderActiveBuses\)[\s\S]*?\n\s*\}/g, 'window.GateStatusBoardController?.scheduleRender?.({ force: true });');

await write(BRANCH_FILES.index, index);
await write(BRANCH_FILES.bootstrap, bootstrap);
await write(BRANCH_FILES.status, status);
await write(BRANCH_FILES.processing, processing);
await write(BRANCH_FILES.bus, bus);
await write(BRANCH_FILES.input, input);

const checks = {
  noStatusFallbacks: !/fallbackDormCard|fallbackActiveBusCard/.test(status),
  noLegacyProcessingScripts: !/prc-dash-dorm-reopen|prc-dash-auditorium-location|prc-dash-processing-loaded-summary/.test(index),
  noLegacyBusScripts: !/prc-dash-sat-arrivals|gate-airport-bus-delete-controller/.test(index),
  noLegacyStatusFunctions: !/function\s+(renderDormColumns|updateTimers|updateAirportMetric)\b/.test(bootstrap),
  noLegacyInputFunctions: !/function\s+(initBatchGrid|initializeWeekGroup|returnToBoard)\b/.test(bootstrap),
  noLegacyBusFunctions: !/function\s+(getNextAirportBusId|confirmBusArrival|openLocalBusModal|closeLocalBusModal)\b/.test(bootstrap)
};
for (const [name, ok] of Object.entries(checks)) assert(ok, `Consolidation check failed: ${name}`);
console.log(JSON.stringify(checks, null, 2));
