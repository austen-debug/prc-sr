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

function extractAttributeValues(contents, tag, attribute) {
  const expression = new RegExp(`<${tag}[^>]*${attribute}="([^"]+)"[^>]*>`, 'g');
  return [...contents.matchAll(expression)].map(match => match[1]);
}

function pathOnly(value) {
  return String(value || '').split('?')[0];
}

test('static application assets match the governed runtime inventory and remain below the cleanup ceiling', async () => {
  const index = await source('public/index.html');
  const middleware = await source('functions/_middleware.js');
  const utilityCss = await source('public/css/gate-utilities-access.css');
  const budget = JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));

  const styles = extractAttributeValues(index, 'link', 'href')
    .filter(value => value.startsWith('/css/'))
    .filter(value => !value.startsWith('/css/gate-application-structure.css'));
  const scripts = extractAttributeValues(index, 'script', 'src')
    .filter(value => value.startsWith('/js/'))
    .filter(value => !value.startsWith('/js/gate-data-sdk.js'))
    .filter(value => !value.startsWith('/js/gate-application-bootstrap'));
  const imports = [...utilityCss.matchAll(/@import\s+url\(['"]([^'"]+)['"]\)/g)].map(match => match[1]);

  assert.deepEqual(styles, budget.currentDirectStyles);
  assert.deepEqual(scripts, budget.currentDirectScripts);
  assert.deepEqual(imports, budget.currentImportedStyles);

  assert.ok(styles.length <= budget.maximums.directStyles);
  assert.ok(scripts.length <= budget.maximums.directScripts);
  assert.ok(imports.length <= budget.maximums.importedStyles);

  assert.ok(budget.maximums.directStyles <= 13, 'The direct stylesheet ceiling may not increase above the audited baseline.');
  assert.ok(budget.maximums.directScripts <= 28, 'The direct script ceiling may not increase above the audited baseline.');
  assert.ok(budget.maximums.importedStyles <= 3, 'The imported stylesheet ceiling may not increase above the audited baseline.');

  assert.doesNotMatch(middleware, /UI_STYLESHEETS|UI_HEAD_SCRIPTS|injectUiAssets|applyStatusBoardMetricSourceRefactor/);
  assert.ok(index.includes('/css/gate-application-structure.css'));
  assert.ok(index.includes('/js/gate-data-sdk.js'));
  assert.ok(index.includes('/js/gate-application-bootstrap.js'));
});

test('no new corrective, patch, restoration, finalizer, cleanup, or stability asset is active', async () => {
  const index = await source('public/index.html');
  const budget = JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));
  const activeAssets = [
    ...extractAttributeValues(index, 'link', 'href').filter(value => value.startsWith('/css/')),
    ...extractAttributeValues(index, 'script', 'src').filter(value => value.startsWith('/js/'))
  ].map(pathOnly);
  const grandfathered = new Set(budget.grandfatheredCorrectiveAssets);
  const correctiveName = /(?:fix|patch|corrective|restore|finalizer|cleanup|stability)/i;
  const correctiveAssets = activeAssets.filter(asset => correctiveName.test(asset));

  assert.deepEqual(correctiveAssets, correctiveAssets.filter(asset => grandfathered.has(asset)));
  for (const asset of correctiveAssets) assert.ok(grandfathered.has(asset), `Unapproved corrective asset activated: ${asset}`);
});

test('middleware is security-only and no Status Board shadow observer remains active', async () => {
  const index = await source('public/index.html');
  const middleware = await source('functions/_middleware.js');
  assert.doesNotMatch(middleware, /review-harness|evidence-retention|evidence-harness|UI_STYLESHEETS|UI_HEAD_SCRIPTS|replace\(.*<\/head>/i);
  assert.doesNotMatch(index, /gate-status-board-shadow-controller\.js/);
  assert.doesNotMatch(middleware, /gate-status-board-shadow-controller\.js/);
  assert.doesNotMatch(middleware, /navigator\.serviceWorker\.register/);
});
