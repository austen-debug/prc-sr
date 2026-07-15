import { escapeAttribute, escapeHtml } from '../components/render-utils.mjs';
import {
  selectConnectivityAnnouncement,
  selectNavigationModel,
  selectPersistenceAnnouncement,
  selectShellContext
} from './selectors.mjs';

function renderRouteButtons(state) {
  return selectNavigationModel(state).map(route => {
    const current = route.ariaCurrent ? ' aria-current="page"' : '';
    return `<button class="gate-shell-route${route.active ? ' gate-shell-route--active' : ''}" type="button" data-gate-action="navigate" data-gate-route="${escapeAttribute(route.id)}"${current}><span class="gate-shell-route__label">${escapeHtml(route.label)}</span><span class="gate-shell-route__short">${escapeHtml(route.shortLabel)}</span></button>`;
  }).join('');
}

export function renderGateNavigation(state) {
  const context = selectShellContext(state);
  const routes = renderRouteButtons(state);
  const label = 'Operational navigation';

  if (context.navigationMode === 'persistent') {
    return `<nav class="gate-shell-navigation gate-shell-navigation--persistent" data-gate-shell-navigation="persistent" aria-label="${label}">${routes}</nav>`;
  }

  const open = context.navigationOpen;
  const controls = 'gate-shell-navigation-panel';
  const trigger = `<button class="gate-shell-menu-trigger" type="button" data-gate-action="toggle-navigation" aria-haspopup="${context.navigationMode === 'sheet' ? 'dialog' : 'true'}" aria-expanded="${open ? 'true' : 'false'}" aria-controls="${controls}"><span>Menu</span><span aria-hidden="true">▾</span></button>`;

  if (context.navigationMode === 'sheet') {
    return `${trigger}<div class="gate-shell-scrim" data-gate-action="close-navigation" aria-hidden="${open ? 'false' : 'true'}"${open ? '' : ' hidden'}></div><section class="gate-shell-navigation gate-shell-navigation--sheet" id="${controls}" data-gate-shell-navigation="sheet" role="dialog" aria-modal="true" aria-label="${label}"${open ? '' : ' hidden'}><header><h2>Navigation</h2><button type="button" data-gate-action="close-navigation" aria-label="Close navigation">×</button></header><nav aria-label="${label}">${routes}</nav></section>`;
  }

  return `${trigger}<nav class="gate-shell-navigation gate-shell-navigation--compact" id="${controls}" data-gate-shell-navigation="compact" aria-label="${label}"${open ? '' : ' hidden'}>${routes}</nav>`;
}

export function renderGateSystemControls(state) {
  const context = selectShellContext(state);
  const controls = [
    { action: 'toggle-theme', label: `Theme: ${context.theme}` },
    { action: 'cycle-density', label: `Density: ${context.density}` },
    { action: 'toggle-sound', label: 'Sound' },
    { action: 'toggle-fullscreen', label: 'Fullscreen' },
    { action: 'session', label: `${context.role} / Logout` }
  ];
  return `<div class="gate-shell-system-controls" aria-label="System controls">${controls.map(control => `<button type="button" class="gate-shell-system-control" data-gate-action="${escapeAttribute(control.action)}">${escapeHtml(control.label)}</button>`).join('')}</div>`;
}

export function renderGateShellStatus(state) {
  const persistence = selectPersistenceAnnouncement(state);
  const connectivity = selectConnectivityAnnouncement(state);
  const notice = state?.notice?.message || '';
  return `<div class="gate-shell-status" data-gate-persistence-state="${escapeAttribute(state?.persistence?.status || 'idle')}"><span class="gate-shell-status__persistence" role="status" aria-live="polite">${escapeHtml(persistence)}</span>${connectivity ? `<span class="gate-shell-status__connectivity" role="status" aria-live="polite">${escapeHtml(connectivity)}</span>` : ''}${notice ? `<span class="gate-shell-status__notice" role="status" aria-live="polite">${escapeHtml(notice)}</span>` : ''}</div>`;
}

export function renderGateAppShell({ state, content = '', title = 'GATE' } = {}) {
  const context = selectShellContext(state);
  const weekGroup = context.weekGroup || 'No Week Group';
  return `<div class="gate-app-shell" data-gate-component="GateAppShell" data-gate-theme="${escapeAttribute(context.theme)}" data-gate-density="${escapeAttribute(context.density)}" data-gate-navigation-mode="${escapeAttribute(context.navigationMode)}" data-gate-navigation-open="${context.navigationOpen ? 'true' : 'false'}" data-gate-role="${escapeAttribute(context.role)}" data-gate-route="${escapeAttribute(context.routeId)}"><a class="gate-shell-skip-link" href="#gate-shell-main">Skip to operational content</a><header class="gate-shell-header"><div class="gate-shell-brand" aria-label="${escapeAttribute(title)}">${escapeHtml(title)}</div><div class="gate-shell-week-group" aria-label="Active week group: ${escapeAttribute(weekGroup)}"><span>Week Group</span><strong>${escapeHtml(weekGroup)}</strong></div>${renderGateNavigation(state)}${renderGateSystemControls(state)}</header>${renderGateShellStatus(state)}<main class="gate-shell-main" id="gate-shell-main" tabindex="-1" aria-label="${escapeAttribute(context.routeLabel || 'Operational content')}">${content}</main></div>`;
}
