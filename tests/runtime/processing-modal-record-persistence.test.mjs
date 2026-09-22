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

test('closed dorm timer edits declare the server manual override contract in the canonical Processing owner', async () => {
  const controller = await source('public/js/gate-processing-controller.js');

  assert.match(controller, /manual_closed_timer_override:\s*isClosed && finalTime !== normalizeFinalTime\(dorm\.closed_timer, '00:00'\) \? 'true' : undefined/);
  assert.match(controller, /const finalTime = isClosed \? normalizeFinalTime\(rawFinalTime, dorm\.closed_timer \|\| '00:00'\)/);
});

test('successful Processing mutations close through their canonical modal owner', async () => {
  const controller = await source('public/js/gate-processing-controller.js');

  assert.match(controller, /const result = await updateDorm\(\{ \.\.\.dorm, current_load: currentLoad[\s\S]*if \(result\?\.isOk\) closeDormModalCanonical\(\)/);
  assert.match(controller, /window\.setTimeout\(closeDormEditModalCanonical, 180\)/);
  assert.match(controller, /if \(result\?\.isOk\) \{\s*closeDormEditModalCanonical\(\)/);
  assert.doesNotMatch(controller, /dataSdk\.update\s*=\s*wrappedUpdate/);
});

test('Processing owns Escape, load Enter, and touch long-press interaction directly', async () => {
  const controller = await source('public/js/gate-processing-controller.js');

  assert.match(controller, /if \(event\.key === 'Escape'\)/);
  assert.match(controller, /const editModal = document\.getElementById\('dorm-edit-modal'\)/);
  assert.match(controller, /event\.target\?\.id === 'modal-load-input'/);
  assert.match(controller, /void saveLoadCanonical\(\)/);
  assert.match(controller, /function handleTouchStart\(event\)/);
  assert.match(controller, /longPressTimer = window\.setTimeout/);
  assert.match(controller, /showContextMenu\(\{ clientX: longPressPoint\.x, clientY: longPressPoint\.y \}, dorm\)/);
});

test('Processing workspace uses responsive geometry and persistent action rails', async () => {
  const css = await source('public/css/military-glass-terminal.css');

  assert.match(css, /grid-template-areas:[\s\S]*"phase load"[\s\S]*"footer footer"/);
  assert.match(css, /max-height:\s*calc\(100dvh - 1rem\)/);
  assert.match(css, /\.gate-processing-workspace__footer\s*\{\s*grid-area:\s*footer/);
  assert.match(css, /@media \(min-width:\s*768px\) and \(max-width:\s*1199px\)/);
  assert.match(css, /@media \(max-width:\s*767px\)/);
  assert.match(css, /\.gate-processing-workspace__footer[\s\S]*position:\s*sticky/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test('closed and empty Processing modals contain the entire load control workspace', async () => {
  const css = await source('public/css/military-glass-terminal.css');

  assert.match(css, /#dorm-modal #modal-phase-section\[style\*="display: none"\] \+ #modal-load-section[\s\S]*grid-column:\s*1 \/ -1/);
  assert.match(css, /#dorm-modal #modal-load-section > \.flex\.items-center\.justify-center\.gap-4\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /#dorm-modal #modal-load-section > \.flex\.items-center\.justify-center\.gap-4\s*\{[\s\S]*width:\s*100%/);
  assert.match(css, /#dorm-modal \.load-btn\s*\{[\s\S]*width:\s*100%[\s\S]*min-width:\s*0/);
  assert.match(css, /#dorm-modal #modal-load-input\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*100%/);
  assert.match(css, /#dorm-modal #modal-load-section > \.flex\.gap-2\.justify-center\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test('Processing modal workspace classes are source-owned and require no corrective runtime', async () => {
  const [index, middleware] = await Promise.all([
    source('public/index.html'),
    source('functions/_middleware.js')
  ]);

  assert.match(index, /modal-content gate-processing-workspace/);
  assert.match(index, /gate-processing-workspace__phase/);
  assert.match(index, /gate-processing-workspace__load/);
  assert.match(index, /modal-content gate-processing-edit-workspace/);
  assert.match(index, /gate-processing-edit-workspace__form/);
  assert.doesNotMatch(middleware, /prc-dash-modal-mobile-validation\.js/);
});
