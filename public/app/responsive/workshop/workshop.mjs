import { createShellState, renderGateAppShell } from '../../shell/index.mjs';
import { selectResponsiveComposition, validateResponsiveComposition } from '../index.mjs';
import { RESPONSIVE_WORKSHOP_FIXTURES } from './fixtures.mjs';

function metaItem(label, value) {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function contentFixture(composition) {
  const cards = Array.from({ length: composition.columnRange[1] }, (_, index) => `<div><strong>Operational region ${index + 1}</strong><p>Container-owned responsive content.</p></div>`).join('');
  return `<section class="gate-responsive-region" aria-label="Responsive content example"><div class="gate-responsive-grid responsive-workshop-placeholder">${cards}</div></section>`;
}

function renderFixture(fixture) {
  const composition = selectResponsiveComposition(fixture);
  const validation = validateResponsiveComposition(composition);
  const state = createShellState({
    role: 'instructor',
    activeRoute: 'board',
    weekGroup: 'WG 26-01',
    density: composition.density,
    navigationMode: composition.navigationMode,
    navigationOpen: false,
    persistenceStatus: 'saved'
  });
  const shell = renderGateAppShell({
    state,
    title: 'GATE',
    content: contentFixture(composition)
  });

  return `<article class="responsive-workshop-card" data-gate-posture="${composition.postureId}" data-gate-pointer="${composition.capabilities.pointer}" data-gate-keyboard="${composition.keyboardShortcuts ? 'true' : 'false'}">
    <header><p>${fixture.width} × ${fixture.height}</p><h2>${composition.postureLabel}</h2></header>
    <dl class="responsive-workshop-card__meta">
      ${metaItem('Navigation', composition.navigationMode)}
      ${metaItem('Density', composition.density)}
      ${metaItem('Columns', `${composition.columnRange[0]}–${composition.columnRange[1]}`)}
      ${metaItem('Pointer', composition.capabilities.pointer)}
      ${metaItem('Keyboard', composition.keyboardShortcuts ? 'available' : 'not assumed')}
      ${metaItem('Target', `${composition.minimumTarget}px minimum`)}
    </dl>
    <div class="responsive-workshop-preview" aria-label="${composition.postureLabel} shell preview">${shell}</div>
    <p>${validation.valid ? 'Contract valid.' : validation.errors.join(' ')}</p>
  </article>`;
}

const grid = document.getElementById('responsive-workshop-grid');
const status = document.getElementById('responsive-workshop-status');
const results = RESPONSIVE_WORKSHOP_FIXTURES.map(fixture => selectResponsiveComposition(fixture));

if (grid) grid.innerHTML = RESPONSIVE_WORKSHOP_FIXTURES.map(renderFixture).join('');
if (status) {
  const valid = results.every(result => validateResponsiveComposition(result).valid);
  status.textContent = valid
    ? `All ${results.length} posture contracts resolved and validated from capability inputs.`
    : 'One or more responsive composition contracts failed validation.';
}
