import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('Processing auditorium field hydrates from the selected dorm on every modal open', async () => {
  const adapter = await source('public/js/prc-dash-auditorium-location.js');

  assert.match(adapter, /registerGateHook\('afterModalOpen', handleModalOpen\)/);
  assert.match(adapter, /payload\?\.modal !== 'processing-dorm'/);
  assert.match(adapter, /hydrateProcessingModal\(payload\.dormId\)/);
  assert.match(adapter, /input\.value = location/);
  assert.match(adapter, /const location = normalizeLocation\(dorm\.auditorium_location \|\| ''\)/);
  assert.match(adapter, /input\.dataset\.dormId = id/);
  assert.match(adapter, /modal\.dataset\.processingDormId = id/);
});

test('Processing assignment save is bound to one exact dorm record', async () => {
  const adapter = await source('public/js/prc-dash-auditorium-location.js');

  assert.match(adapter, /activeId !== modalId \|\| activeId !== inputId/);
  assert.match(adapter, /if \(!activeId \|\| !boundId\)/);
  assert.match(adapter, /hydrateProcessingModal\(activeId\)/);
  assert.match(adapter, /const dorm = getDormById\(boundId\)/);
  assert.match(adapter, /assigned_airman: normalizeAirman\(airmanInput\.value\)/);
  assert.match(adapter, /auditorium_location: normalizeLocation\(locationInput\.value\)/);
  assert.match(adapter, /controller\.updateDorm\(payload, \{ source: 'processing-assignment-location-update' \}\)/);
  assert.doesNotMatch(adapter, /window\.dataSdk\.update/);
});

test('Processing modal clears transient values when it closes', async () => {
  const adapter = await source('public/js/prc-dash-auditorium-location.js');

  assert.match(adapter, /function clearProcessingModalState\(\)/);
  assert.match(adapter, /if \(airman\) airman\.value = ''/);
  assert.match(adapter, /location\.value = ''/);
  assert.match(adapter, /delete location\.dataset\.dormId/);
  assert.match(adapter, /delete modal\.dataset\.processingDormId/);
  assert.match(adapter, /modalObserver\.observe\(modal, \{ attributes: true, attributeFilter: \['class', 'aria-hidden'\] \}\)/);
});

test('Enter-key saves use the same bound record mutation path', async () => {
  const adapter = await source('public/js/prc-dash-auditorium-location.js');

  assert.match(adapter, /window\.addEventListener\('keydown', handleWindowKeydown, true\)/);
  assert.match(adapter, /#modal-airman-input, #modal-auditorium-input/);
  assert.match(adapter, /event\.stopImmediatePropagation\?\.\(\)/);
  assert.match(adapter, /saveProcessingAssignmentAndLocation\(\)/);
});

test('Auditorium card augmentation no longer observes the entire document', async () => {
  const adapter = await source('public/js/prc-dash-auditorium-location.js');

  assert.doesNotMatch(adapter, /observer\.observe\(document\.body/);
  assert.doesNotMatch(adapter, /patchOpenDormModal/);
  assert.doesNotMatch(adapter, /originalOpen/);
  assert.match(adapter, /delegatesPersistenceTo: 'gate-processing-controller'/);
});

test('closed dorm timer edits declare the server manual override contract', async () => {
  const lifecycle = await source('public/js/prc-dash-modal-mobile-validation.js');

  assert.match(lifecycle, /function withManualClosedTimerOverride\(record\)/);
  assert.match(lifecycle, /existingState !== 'closed' \|\| incomingState !== 'closed'/);
  assert.match(lifecycle, /manual_closed_timer_override: 'true'/);
  assert.match(lifecycle, /const payload = withManualClosedTimerOverride\(record\)/);
});

test('successful Processing mutations share one completion lifecycle', async () => {
  const lifecycle = await source('public/js/prc-dash-modal-mobile-validation.js');

  assert.match(lifecycle, /function returnToProcessingAfterSuccess\(\)/);
  assert.match(lifecycle, /if \(result\?\.isOk && isProcessingDormMutation\(payload\)\) returnToProcessingAfterSuccess\(\)/);
  assert.match(lifecycle, /window\.closeDormEditModal\?\.\(\)/);
  assert.match(lifecycle, /window\.closeDormModal\?\.\(\)/);
  assert.match(lifecycle, /window\.showPage\('processing'\)/);
  assert.match(lifecycle, /GateProcessingController\?\.scheduleRender\?\.\(\{ force: true \}\)/);
  assert.doesNotMatch(lifecycle, /GateProcessingController\?\.refresh\?\.\(\)/);
});

test('validation failures stay open while Escape only cancels the topmost modal', async () => {
  const lifecycle = await source('public/js/prc-dash-modal-mobile-validation.js');

  assert.doesNotMatch(lifecycle, /finally\s*\{[^}]*returnToProcessingAfterSuccess/s);
  assert.match(lifecycle, /if \(event\.key === 'Escape'\) \{\s*cancelTopmostProcessingModal\(event\)/s);
  assert.match(lifecycle, /if \(isVisible\(editModal\)\)/);
  assert.match(lifecycle, /if \(isVisible\(processingModal\)\)/);
  assert.match(lifecycle, /event\.target\?\.id === 'modal-load-input'/);
  assert.match(lifecycle, /window\.saveLoad\?\.\(\)/);
});

test('Processing workspace uses responsive geometry and persistent action rails', async () => {
  const css = await source('public/css/gate-processing-modal-workspace.css');

  assert.match(css, /grid-template-areas:[\s\S]*"phase load"[\s\S]*"footer footer"/);
  assert.match(css, /max-height: calc\(100dvh - 1rem\)/);
  assert.match(css, /\.gate-processing-workspace__footer[\s\S]*grid-area: footer/);
  assert.match(css, /@media \(max-height: 800px\) and \(min-width: 761px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /position: sticky !important;/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
