import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  POSTURE_IDS,
  POSTURES,
  normalizeCompositionInput,
  resolvePostureId,
  selectContainerBand,
  selectComponentContainerVariant,
  selectResponsiveComposition,
  validateContainerContracts,
  validatePostureRegistry,
  validateResponsiveComposition
} from '../../../public/app/responsive/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '../../..');
const fixtures = JSON.parse(await readFile(resolve(here, './fixtures/B2-P2-F002-postures.json'), 'utf8'));

async function repositoryFile(path) {
  return readFile(resolve(repositoryRoot, path), 'utf8');
}

test('Phase 2D defines exactly the six governed responsive postures', () => {
  assert.deepEqual(POSTURES.map(item => item.id), POSTURE_IDS);
  assert.deepEqual(validatePostureRegistry(), { valid: true, errors: [] });
  assert.equal(POSTURES.length, 6);
});

test('all six posture fixtures resolve to the expected shell and interaction contracts', () => {
  for (const fixture of fixtures) {
    const composition = selectResponsiveComposition(fixture.input);
    for (const [key, expected] of Object.entries(fixture.expected)) {
      assert.deepEqual(composition[key], expected, `${fixture.id}: ${key}`);
    }
    assert.deepEqual(validateResponsiveComposition(composition), { valid: true, errors: [] }, fixture.id);
  }
});

test('posture thresholds are contiguous at every governed boundary', () => {
  const cases = [
    [{ width: 1179, height: 800 }, 'tablet-landscape'],
    [{ width: 1180, height: 699 }, 'tablet-landscape'],
    [{ width: 1180, height: 700 }, 'desktop-landscape'],
    [{ width: 767, height: 400 }, 'phone-landscape'],
    [{ width: 768, height: 400 }, 'tablet-landscape'],
    [{ width: 899, height: 1200 }, 'tablet-portrait'],
    [{ width: 900, height: 1179 }, 'tablet-portrait'],
    [{ width: 900, height: 1180 }, 'desktop-vertical'],
    [{ width: 599, height: 900 }, 'phone-portrait'],
    [{ width: 600, height: 900 }, 'tablet-portrait']
  ];

  for (const [input, expected] of cases) assert.equal(resolvePostureId(input), expected, JSON.stringify(input));
});

test('orientation is derived from available geometry rather than a device identifier', () => {
  assert.equal(normalizeCompositionInput({ width: 800, height: 800 }).orientation, 'landscape');
  assert.equal(normalizeCompositionInput({ width: 799, height: 800 }).orientation, 'portrait');
  assert.equal(resolvePostureId({ width: 1400, height: 900 }), 'desktop-landscape');
  assert.equal(resolvePostureId({ width: 1080, height: 1920 }), 'desktop-vertical');
});

test('coarse or absent pointer capability forces touch density and a 44px target', () => {
  for (const pointer of ['coarse', 'none']) {
    const composition = selectResponsiveComposition({ width: 1440, height: 900, pointer, hover: true, keyboard: true });
    assert.equal(composition.postureId, 'desktop-landscape');
    assert.equal(composition.density, 'touch');
    assert.equal(composition.minimumTarget, 44);
    assert.equal(composition.hoverEnhancements, false);
  }
});

test('fine pointer, hover, and keyboard remain independent capability signals', () => {
  const composition = selectResponsiveComposition({ width: 1440, height: 900, pointer: 'fine', hover: true, keyboard: false });
  assert.equal(composition.density, 'command');
  assert.equal(composition.hoverEnhancements, true);
  assert.equal(composition.keyboardShortcuts, false);
  assert.equal(composition.minimumTarget, 32);
});

test('safe-area values are normalized and preserved without entering operational state', () => {
  const composition = selectResponsiveComposition({
    width: 390,
    height: 844,
    safeArea: { top: 47, right: -10, bottom: '34', left: Number.NaN }
  });
  assert.deepEqual(composition.safeArea, { top: 47, right: 0, bottom: 34, left: 0 });
  assert.equal(Object.isFrozen(composition.safeArea), true);
});

test('component container bands are contiguous and select deterministic variants', () => {
  assert.deepEqual(validateContainerContracts(), { valid: true, errors: [] });
  assert.equal(selectContainerBand(0).id, 'compact');
  assert.equal(selectContainerBand(319).id, 'compact');
  assert.equal(selectContainerBand(320).id, 'standard');
  assert.equal(selectContainerBand(639).id, 'standard');
  assert.equal(selectContainerBand(640).id, 'expanded');
  assert.deepEqual(selectComponentContainerVariant('GateDormCard', 319), { componentName: 'GateDormCard', band: 'compact', variant: 'summary' });
  assert.deepEqual(selectComponentContainerVariant('GateDormCard', 640), { componentName: 'GateDormCard', band: 'expanded', variant: 'detailed' });
});

test('responsive CSS assigns shell composition through viewport queries and components through container queries', async () => {
  const css = await repositoryFile('public/app/responsive/gate-responsive.css');
  for (const postureId of POSTURE_IDS) assert.match(css, new RegExp(`data-gate-posture=['"]${postureId}`));
  assert.match(css, /@media \(orientation: portrait\)/);
  assert.match(css, /@media \(orientation: landscape\)/);
  assert.match(css, /min-width: 73\.75rem/);
  assert.match(css, /min-height: 73\.75rem/);
  assert.match(css, /@container gate-responsive-region/);
  assert.match(css, /var\(--gate-safe-top\)/);
  assert.match(css, /\(pointer: coarse\), \(pointer: none\)/);
  assert.match(css, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla)\s*\(/i);
  assert.doesNotMatch(css, /#page-|\.page-board|\.page-processing|\.page-airport/i);
  assert.doesNotMatch(css, /--gate-control-height:\s*max\([^;]*var\(--gate-control-height\)/i);
  assert.doesNotMatch(css, /--gate-row-height:\s*max\([^;]*var\(--gate-row-height\)/i);
});

test('responsive core is pure and contains no device detection, DOM mutation, or CSS injection', async () => {
  const paths = [
    'public/app/responsive/posture-registry.mjs',
    'public/app/responsive/composition-selector.mjs',
    'public/app/responsive/container-registry.mjs',
    'public/app/responsive/index.mjs'
  ];
  const source = (await Promise.all(paths.map(repositoryFile))).join('\n');
  assert.doesNotMatch(source, /navigator\.userAgent|iPhone|iPad|Android|Windows Phone/i);
  assert.doesNotMatch(source, /\b(?:document|window|matchMedia|ResizeObserver)\b/);
  assert.doesNotMatch(source, /createElement\(['"]style|insertRule|adoptedStyleSheets|\.style\s*=/i);
  assert.doesNotMatch(source, /fetch\s*\(|\/api\/records|Gate\w+Repository/);
});

test('responsive workshop exercises all six postures from the same shell surface', async () => {
  const html = await repositoryFile('public/app/responsive/workshop/index.html');
  const source = await repositoryFile('public/app/responsive/workshop/workshop.mjs');
  const fixtureSource = await repositoryFile('public/app/responsive/workshop/fixtures.mjs');
  assert.match(html, /gate-responsive\.css/);
  assert.match(html, /type="module" src="\.\/workshop\.mjs"/);
  assert.match(source, /renderGateAppShell/);
  assert.match(source, /selectResponsiveComposition/);
  for (const postureId of POSTURE_IDS) assert.match(fixtureSource, new RegExp(postureId));
  assert.doesNotMatch(source, /navigator\.userAgent|iPhone|iPad|Android/i);
});

test('Build 1 middleware does not load responsive or responsive-workshop assets', async () => {
  const middleware = await repositoryFile('functions/_middleware.js');
  assert.doesNotMatch(middleware, /\/app\/responsive|responsive\/workshop|gate-responsive\.css/);
});
