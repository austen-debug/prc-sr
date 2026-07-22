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
