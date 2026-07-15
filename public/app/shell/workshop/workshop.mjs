import {
  renderGateCommandBar,
  renderGateMetricCard,
  renderGateNotification,
  renderGatePageHeader
} from '../../components/index.mjs';
import {
  createShellStore,
  renderGateAppShell,
  selectShellContext
} from '../index.mjs';

const root = document.getElementById('gate-shell-workshop');
const store = createShellStore({
  role: 'instructor',
  activeRoute: 'board',
  weekGroup: 'WG 26-01',
  theme: 'dark',
  density: 'standard',
  navigationMode: 'persistent',
  persistenceStatus: 'saved',
  persistenceMessage: 'Saved',
  online: true,
  lastSyncedAt: '2026-07-15T17:45:00Z'
});

const densityOrder = ['command', 'standard', 'touch'];
let returnFocusAction = null;

function workshopButton(label, attribute, value) {
  return `<button type="button" ${attribute}="${value}">${label}</button>`;
}

function renderWorkshopContent(state) {
  const context = selectShellContext(state);
  const roleControls = ['instructor', 'airman', 'squadron'].map(role => workshopButton(role, 'data-workshop-role', role)).join('');
  const modeControls = ['persistent', 'compact', 'sheet'].map(mode => workshopButton(mode, 'data-workshop-mode', mode)).join('');
  const persistenceControls = ['idle', 'saving', 'saved', 'failed', 'conflict', 'stale'].map(status => workshopButton(status, 'data-workshop-persistence', status)).join('');

  const pageHeader = renderGatePageHeader({
    eyebrow: 'Unified shell workshop',
    title: context.routeLabel,
    description: 'Inactive Build 2 reference composition. No Build 1 workflow is loaded.',
    status: { state: state.connectivity.online ? 'saved' : 'stale', label: state.connectivity.online ? 'Online' : 'Offline' }
  });

  const commandBar = renderGateCommandBar({
    context: `${context.role} · ${context.weekGroup || 'No Week Group'}`,
    persistenceState: context.persistenceStatus,
    persistenceLabel: context.persistenceAnnouncement || context.persistenceStatus,
    actions: [{ label: 'Reference action', action: 'reference-action', variant: 'secondary' }]
  });

  const metrics = [
    renderGateMetricCard({ label: 'Current route', value: context.routeLabel || '—', supportingText: context.routeId }),
    renderGateMetricCard({ label: 'Navigation', value: context.navigationMode, supportingText: context.navigationOpen ? 'Open' : 'Closed' }),
    renderGateMetricCard({ label: 'Role', value: context.role, supportingText: 'Canonical permission registry' })
  ].join('');

  const offline = state.connectivity.online ? '' : renderGateNotification({ variant: 'warning', title: 'Offline', message: context.connectivityAnnouncement });

  return `<div class="gate-shell-workshop-content">${pageHeader}${commandBar}${offline}<section class="gate-shell-workshop-panel" aria-labelledby="workshop-role-heading"><h2 id="workshop-role-heading">Role simulation</h2><div class="gate-shell-workshop-controls">${roleControls}</div></section><section class="gate-shell-workshop-panel" aria-labelledby="workshop-mode-heading"><h2 id="workshop-mode-heading">Navigation presentation</h2><div class="gate-shell-workshop-controls">${modeControls}</div></section><section class="gate-shell-workshop-panel" aria-labelledby="workshop-persistence-heading"><h2 id="workshop-persistence-heading">Persistence state</h2><div class="gate-shell-workshop-controls">${persistenceControls}${workshopButton(state.connectivity.online ? 'Go offline' : 'Go online', 'data-workshop-online', state.connectivity.online ? 'false' : 'true')}</div></section><div class="gate-shell-workshop-grid">${metrics}</div><section class="gate-shell-workshop-panel"><h2>Current shell state</h2><pre class="gate-shell-workshop-state">${JSON.stringify(state, null, 2)}</pre></section></div>`;
}

function focusAfterRender(state, event) {
  if (event?.type === 'navigation.opened' || (event?.type === 'navigation.toggled' && state.navigation.open)) {
    root.querySelector('.gate-shell-navigation--sheet button, .gate-shell-navigation--compact button')?.focus();
    return;
  }
  if (event?.type === 'navigation.closed' || event?.type === 'route.requested') {
    root.querySelector('[data-gate-action="toggle-navigation"]')?.focus();
  }
}

function render(state = store.getState(), event = null) {
  document.documentElement.dataset.gateTheme = state.theme;
  document.documentElement.dataset.gateDensity = state.density;
  root.innerHTML = renderGateAppShell({ state, content: renderWorkshopContent(state) });
  focusAfterRender(state, event);
}

store.subscribe((state, _previous, event) => render(state, event));
render();

root.addEventListener('click', event => {
  const target = event.target.closest('button, [data-gate-action]');
  if (!target) return;

  if (target.dataset.workshopRole) {
    store.dispatch({ type: 'role.changed', role: target.dataset.workshopRole });
    return;
  }
  if (target.dataset.workshopMode) {
    store.dispatch({ type: 'navigation.modeChanged', mode: target.dataset.workshopMode });
    return;
  }
  if (target.dataset.workshopPersistence) {
    const status = target.dataset.workshopPersistence;
    store.dispatch({ type: 'persistence.changed', status, message: status === 'failed' ? 'Save failed. Retry required.' : status });
    return;
  }
  if (target.dataset.workshopOnline) {
    store.dispatch({ type: 'connectivity.changed', online: target.dataset.workshopOnline === 'true', lastSyncedAt: store.getState().connectivity.lastSyncedAt });
    return;
  }

  const action = target.dataset.gateAction;
  if (action === 'navigate') store.dispatch({ type: 'route.requested', routeId: target.dataset.gateRoute });
  if (action === 'toggle-navigation') {
    returnFocusAction = action;
    store.dispatch({ type: 'navigation.toggled' });
  }
  if (action === 'close-navigation') store.dispatch({ type: 'navigation.closed' });
  if (action === 'toggle-theme') store.dispatch({ type: 'theme.changed', theme: store.getState().theme === 'dark' ? 'light' : 'dark' });
  if (action === 'cycle-density') {
    const current = densityOrder.indexOf(store.getState().density);
    store.dispatch({ type: 'density.changed', density: densityOrder[(current + 1) % densityOrder.length] });
  }
});

document.addEventListener('keydown', event => {
  const state = store.getState();
  if (event.key === 'Escape' && state.navigation.open) {
    event.preventDefault();
    store.dispatch({ type: 'navigation.closed' });
    return;
  }

  const sheet = root.querySelector('.gate-shell-navigation--sheet:not([hidden])');
  if (!sheet || event.key !== 'Tab') return;
  const focusable = [...sheet.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
