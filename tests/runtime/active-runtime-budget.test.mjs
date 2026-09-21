import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
async function source(path) {return readFile(resolve(root,path),'utf8');}
function extractArrayBlock(contents, variableName) {
  const match = contents.match(new RegExp(`const ${variableName} = \\[([\\s\\S]*?)\\n\\];`));
  assert.ok(match, `${variableName} must remain a statically auditable shell array.`);
  return match[1];
}
const attrs=(block,attribute)=>[...block.matchAll(new RegExp(`${attribute}="([^"]+)"`,'g'))].map(match=>match[1]);
const pathOnly=value=>String(value||'').split('?')[0];

async function activeShell() {
  const gate=await source('functions/_middleware.js');
  assert.match(gate,/verifyRequestSession/,'The root gate must verify sessions before serving the shell.');
  assert.match(gate,/renderLegacyShell\(context\)/,'The root gate must delegate Instructor/Airman rendering.');
  assert.match(gate,/session\.role === 'squadron'/,'Squadron sessions must not enter the legacy application.');
  return source('functions/gate-shell-legacy.mjs');
}

test('active shell assets match the governed runtime inventory and remain below the cleanup ceiling',async()=>{
  const shell=await activeShell();
  const css=await source('public/css/military-glass-terminal.css');
  const budget=JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));
  const styles=attrs(extractArrayBlock(shell,'UI_STYLESHEETS'),'href');
  const scripts=attrs(extractArrayBlock(shell,'UI_HEAD_SCRIPTS'),'src');
  const imports=[...css.matchAll(/@import\s+url\(['"]([^'"]+)['"]\)/g)].map(match=>match[1]);
  assert.deepEqual(styles,budget.currentDirectStyles);
  assert.deepEqual(scripts,budget.currentDirectScripts);
  assert.deepEqual(imports,budget.currentImportedStyles);
  assert.ok(styles.length<=budget.maximums.directStyles);
  assert.ok(scripts.length<=budget.maximums.directScripts);
  assert.ok(imports.length<=budget.maximums.importedStyles);
  assert.equal(styles.length,1);
  assert.equal(pathOnly(styles[0]),'/css/military-glass-terminal.css');
  assert.equal(imports.length,0);
  assert.doesNotMatch(css,/!important\s*;/);
  assert.ok(budget.maximums.directStyles<=1);
  assert.ok(budget.maximums.directScripts<=28);
  assert.equal(budget.maximums.importedStyles,0);
  assert.ok(budget.phase3BExitTargets.directStylesMaximum<=budget.maximums.directStyles);
  assert.ok(budget.phase3BExitTargets.directScriptsMaximum<budget.maximums.directScripts);
  assert.equal(budget.phase3BExitTargets.correctiveAssetsAdded,0);
  assert.equal(budget.phase3BExitTargets.statusBoardLegacyOwnersRetired,true);
  assert.equal(budget.phase3BExitTargets.middlewareStatusBoardSourceRewriteRemoved,true);
});

test('active scripts do not inject secondary stylesheet authorities',async()=>{
  const shell=await activeShell();
  const scripts=attrs(extractArrayBlock(shell,'UI_HEAD_SCRIPTS'),'src').map(pathOnly);
  for(const asset of scripts){
    const contents=await source(`public${asset}`);
    assert.doesNotMatch(contents,/createElement\(['"]style['"]\)/,`${asset} may not inject a runtime style block.`);
    assert.doesNotMatch(contents,/createElement\(['"]link['"]\)[\s\S]{0,400}stylesheet/,`${asset} may not inject a runtime stylesheet.`);
  }
});

test('no new corrective, patch, restoration, finalizer, cleanup, or stability asset is active',async()=>{
  const shell=await activeShell();
  const budget=JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));
  const activeAssets=[...attrs(extractArrayBlock(shell,'UI_STYLESHEETS'),'href'),...attrs(extractArrayBlock(shell,'UI_HEAD_SCRIPTS'),'src')].map(pathOnly);
  const grandfathered=new Set(budget.grandfatheredCorrectiveAssets);
  const correctiveName=/(?:fix|patch|corrective|restore|finalizer|cleanup|stability)/i;
  const correctiveAssets=activeAssets.filter(asset=>correctiveName.test(asset));
  assert.deepEqual(correctiveAssets,correctiveAssets.filter(asset=>grandfathered.has(asset)));
  for(const asset of correctiveAssets)assert.ok(grandfathered.has(asset),`Unapproved corrective asset activated: ${asset}`);
});

test('evidence tooling remains outside active shell and the Phase 3A shadow bridge remains singular',async()=>{
  const gate=await source('functions/_middleware.js');
  const shell=await activeShell();
  for(const content of [gate,shell]){
    assert.doesNotMatch(content,/review-harness|evidence-retention|evidence-harness/i);
    assert.doesNotMatch(content,/navigator\.serviceWorker\.register/);
  }
  assert.equal((shell.match(/gate-status-board-shadow-controller\.js/g)||[]).length,1);
});
