import fs from 'node:fs/promises';

const path = 'public/js/gate-status-board-controller.js';
let source = await fs.readFile(path, 'utf8');
const assert = (value, message) => { if (!value) throw new Error(message); };

source = source.replace(/\n  function fallbackDormCard\([\s\S]*?\n  function renderDormCard/, '\n  function renderDormCard');
source = source.replace(/const html = components\(\)\?\.dormCard\s*\? components\(\)\.dormCard\(dorm, \{ showAuditorium: true \}\)\s*:\s*fallbackDormCard\(dorm\);/, "const html = components()?.dormCard?.(dorm, { showAuditorium: true });\n    if (!html) throw new Error('GateComponents.dormCard is required.');");
source = source.replace(/\n  function fallbackActiveBusCard\([\s\S]*?\n  function hasCompleteActiveBusMarkup/, '\n  function hasCompleteActiveBusMarkup');
source = source.replace(/container\.innerHTML = buses\s*\.map\(bus => components\(\)\?\.activeBusCard\s*\? components\(\)\.activeBusCard\(bus\)\.replace\('data-owner="gate-active-bus-controller"', 'data-owner="gate-status-board-controller"'\)\s*:\s*fallbackActiveBusCard\(bus\)\)\s*\.join\(''\);/, "container.innerHTML = buses.map(bus => {\n      const html = components()?.activeBusCard?.(bus);\n      if (!html) throw new Error('GateComponents.activeBusCard is required.');\n      return html.replace('data-owner=\"gate-active-bus-controller\"', 'data-owner=\"gate-status-board-controller\"').replace('<button', '<button data-gate-bus-arrival=\"true\"');\n    }).join('');");
source = source.replace(/\n  function ensureTimerOwner\(\) \{[\s\S]*?\n  \}/, `\n  function ensureTimerOwner() {\n    if (!canonicalTimerTimeout) restartTimerOwner();\n    else canonicalTimerTick();\n    return canonicalTimerTimeout;\n  }`);
source = source.replace(/\n  function patchLegacyBoardGlobals\(\) \{[\s\S]*?\n  function registerHooksOnce/, '\n  function registerHooksOnce');
source = source.replace(/\n\s*patchLegacyBoardGlobals\(\);/g, '\n');

assert(!/fallbackDormCard|fallbackActiveBusCard/.test(source), 'Fallback renderer remains.');
assert(!/window\.(getElapsedTimer|updateTimers)/.test(source), 'Timer compatibility globals remain.');
assert(!/patchLegacyBoardGlobals/.test(source), 'Legacy board global patch remains.');
assert(!/onclick="/.test(source), 'Inline click handler remains.');

await fs.writeFile(path, source);
console.log('Status Board canonical cleanup complete.');
