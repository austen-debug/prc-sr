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

function extractArrayBlock(contents, variableName) {
  const match = contents.match(new RegExp(`const ${variableName} = \\[([\\s\\S]*?)\\n\\];`));
  assert.ok(match, `${variableName} must remain a statically auditable middleware array.`);
  return match[1];
}

function extractAttributeValues(block, attribute) {
  return [...block.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map(match => match[1]);
}

function pathOnly(value) {
  return String(value || '').split('?')[0];
}

test('active middleware assets match the governed runtime inventory and remain below the cleanup ceiling', async () => {
  const middleware = await source('functions/_middleware.js');
  const utilityCss = await source('public/css/gate-utilities-access.css');
  const budget = JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));

  const styles = extractAttributeValues(extractArrayBlock(middleware, 'UI_STYLESHEETS'), 'href');
  const scripts = extractAttributeValues(extractArrayBlock(middleware, 'UI_HEAD_SCRIPTS'), 'src');
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

  assert.ok(budget.phase3BExitTargets.directStylesMaximum < budget.maximums.directStyles);
  assert.ok(budget.phase3BExitTargets.directScriptsMaximum < budget.maximums.directScripts);
  assert.equal(budget.phase3BExitTargets.correctiveAssetsAdded, 0);
  assert.equal(budget.phase3BExitTargets.statusBoardLegacyOwnersRetired, true);
  assert.equal(budget.phase3BExitTargets.middlewareStatusBoardSourceRewriteRemoved, true);
});

test('no new corrective, patch, restoration, finalizer, cleanup, or stability asset is active', async () => {
  const middleware = await source('functions/_middleware.js');
  const budget = JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));
  const activeAssets = [
    ...extractAttributeValues(extractArrayBlock(middleware, 'UI_STYLESHEETS'), 'href'),
    ...extractAttributeValues(extractArrayBlock(middleware, 'UI_HEAD_SCRIPTS'), 'src')
  ].map(pathOnly);
  const grandfathered = new Set(budget.grandfatheredCorrectiveAssets);
  const correctiveName = /(?:fix|patch|corrective|restore|finalizer|cleanup|stability)/i;
  const correctiveAssets = activeAssets.filter(asset => correctiveName.test(asset));

  assert.deepEqual(correctiveAssets, correctiveAssets.filter(asset => grandfathered.has(asset)));
  for (const asset of correctiveAssets) assert.ok(grandfathered.has(asset), `Unapproved corrective asset activated: ${asset}`);
});

test('evidence tooling remains outside active middleware and the Phase 3A shadow bridge remains singular', async () => {
  const middleware = await source('functions/_middleware.js');
  assert.doesNotMatch(middleware, /review-harness|evidence-retention|evidence-harness/i);
  assert.equal((middleware.match(/gate-status-board-shadow-controller\.js/g) || []).length, 1);
  assert.doesNotMatch(middleware, /navigator\.serviceWorker\.register/);
});
