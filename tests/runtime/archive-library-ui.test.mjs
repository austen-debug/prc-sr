import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const root = new URL('../../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('Archive controller remains syntactically valid and preserves all existing report actions', async () => {
  const js = await load('public/js/gate-archive-controller.js');
  assert.doesNotThrow(() => new Script(js, { filename: 'gate-archive-controller.js' }));
  for (const button of ['print-current-summary-btn', 'print-tags-btn', 'print-matrix-btn']) {
    assert.match(js, new RegExp('id="' + button + '"'));
  }
  assert.match(js, /function printCurrentSummaryReport\(event\)/);
  assert.match(js, /function printDormTags\(event\)/);
  assert.match(js, /function openMatrixDialog\(event\)/);
  assert.match(js, /function printArchiveReport\(event\)/);
  assert.match(js, /data-archive-print-id/);
  assert.match(js, /function buildArchivePayload\(/);
  assert.match(js, /function runSafeCloseout\(/);
});

test('Archive browser is a quiet, full-width document index with no automatic selection', async () => {
  const js = await load('public/js/gate-archive-controller.js');
  const browser = js.slice(js.indexOf('  function archiveListRow('), js.indexOf('  function archiveDormRows('));
  const render = js.slice(js.indexOf('  function renderArchiveManagementView('), js.indexOf('  function bindArchiveSearchControls('));
  assert.match(js, /let selectedArchiveId = '';/);
  assert.doesNotMatch(js, /if \(!selectedArchiveId && archiveIndex\.length\) selectedArchiveId/);
  assert.match(browser, /gate-archive-list-row/);
  assert.match(browser, /gate-archive-year-group/);
  assert.match(browser, /archive\.total_arrived/);
  assert.match(browser, /archive\.dorm_count/);
  assert.doesNotMatch(browser, /gate-archive-month/);
  assert.doesNotMatch(browser, /gate-archive-record-card/);
  assert.match(render, /gate-archive-library-mode/);
  assert.match(render, /gate-archive-detail-mode/);
  assert.match(render, /selectedArchiveId/);
  assert.match(render, /groupedArchiveHtml\(visible\)/);
  assert.doesNotMatch(render, /gate-archive-layout/);
  assert.doesNotMatch(render, /archiveMetric\(/);
  assert.match(render, /Search Week Group/);
  assert.match(render, /gate-archive-year-filter/);
});

test('Focused detail view protects historical data with accessible on-demand disclosures', async () => {
  const js = await load('public/js/gate-archive-controller.js');
  const detail = js.slice(js.indexOf('  function archiveBackButton('), js.indexOf('  function renderArchiveManagementView('));
  assert.match(detail, /gate-archive-back/);
  assert.match(detail, /gate-archive-detail-section/);
  assert.match(detail, /<details /);
  assert.match(detail, /<summary>/);
  assert.match(detail, /data-archive-panel/);
  assert.match(detail, /openPanels\.has\(key\)/);
  for (const panel of ['dorms', 'buses', 'windows', 'history']) {
    assert.match(detail, new RegExp("archiveDetailSection\\('" + panel + "'"));
  }
  assert.match(detail, /archiveDormRows\(dorms\)/);
  assert.match(detail, /archiveBusRows\(buses\)/);
  assert.match(detail, /archiveAmendments\(amendments\)/);
  assert.match(detail, /archive\.archive_schema_version/);
  assert.match(detail, /lifecycle\.state/);
  assert.match(js, /function showArchiveLibrary\(\)/);
  assert.match(js, /event\.target\?\.closest\?\.\('#gate-archive-back'\)/);
  assert.match(js, /function loadArchiveDetail\(id, force = false\)/);
});

test('Archive style is scoped and adapts to small screens without changing header buttons', async () => {
  const css = await load('public/css/military-glass-terminal.css');
  const addition = css.slice(css.indexOf('/* GATE archive library simplification'));
  assert.ok(addition.startsWith('/* GATE archive library simplification'));
  for (const className of [
    'gate-archive-toolbar-simple', 'gate-archive-library', 'gate-archive-list-row',
    'gate-archive-focused-detail', 'gate-archive-overview',
    'gate-archive-detail-section', 'gate-archive-back-action'
  ]) {
    assert.ok(addition.includes('#page-archives .' + className), 'Missing scoped rule: ' + className);
  }
  assert.match(addition, /@media \(max-width: 740px\)/);
  assert.doesNotMatch(addition, /#page-archives \.gate-archive-hero\s*\{/);
  assert.doesNotMatch(addition, /#page-archives \.gate-archive-current-report\s*\{/);
  assert.doesNotMatch(addition, /#gate-matrix-dialog/);
});


test('Visible archive correction uses canonical append-only form and retires competing inline save',async()=>{
  const js=await load('public/js/gate-archive-controller.js');
  const html=await load('public/index.html');
  const handler=js.slice(js.indexOf('  async function saveArchiveEdit('),js.indexOf('  function archiveSpaceForceTotal('));
  assert.match(js,/data-archive-amend-id/);
  assert.match(js,/CREATE AMENDMENT/);
  assert.match(js,/archiveDetailCache\.get\(String\(id \|\| ''\)\)\?\.archive/);
  assert.match(handler,/action:'amend_archive'/);
  assert.match(handler,/expected_amendment_count:detail\.amendments\.length/);
  assert.match(handler,/request_id:requestId/);
  assert.match(handler,/response\?\.status===409/);
  assert.match(handler,/void loadArchiveDetail\(id,true\)/);
  assert.match(handler,/amendment\.amendment_id|item\.amendment_id===requestId/);
  assert.doesNotMatch(handler,/dataSdk\.update\(/);
  assert.match(html,/id="archive-edit-reason" required minlength="5"/);
  assert.match(html,/CREATE AMENDMENT<\/button>/);
  assert.doesNotMatch(html,/id="archive-edit-dorm-data"/);
  assert.doesNotMatch(html,/id="archive-edit-bus-data"/);
  assert.doesNotMatch(html,/document\.getElementById\('archive-edit-form'\)\.addEventListener\('submit'/);
  assert.doesNotMatch(html,/SAVE ARCHIVE<\/button>/);
});

test('Failed archive detail requests remain retryable rather than permanently cached as empty history',async()=>{
  const js=await load('public/js/gate-archive-controller.js');
  const loader=js.slice(js.indexOf('  async function loadArchiveDetail('),js.indexOf('  function archiveTotals('));
  assert.match(loader,/archiveDetailCache\.get\(key\)\?\.isOk!==false/);
  assert.match(loader,/archiveDetailPromises\.delete\(key\)/);
});
