import {
  renderGateBusCard,
  renderGateButton,
  renderGateCommandBar,
  renderGateDataTable,
  renderGateDialog,
  renderGateDormCard,
  renderGateFormField,
  renderGateMetricCard,
  renderGateNotification,
  renderGatePageHeader,
  renderGateSheet,
  renderGateStatusPill
} from '../components/index.mjs';
import { workshopFixtures } from './fixtures.mjs';

const root = document.getElementById('gate-workshop');
let returnFocus = null;

function section(title, description, content) {
  return `<section class="workshop-section"><header><h2>${title}</h2><p>${description}</p></header><div class="workshop-grid">${content}</div></section>`;
}

function renderWorkshop() {
  const buttonStates = [
    renderGateButton({ label: 'Primary action', variant: 'primary', action: 'demo-primary' }),
    renderGateButton({ label: 'Secondary action', variant: 'secondary', action: 'demo-secondary' }),
    renderGateButton({ label: 'Quiet action', variant: 'quiet', action: 'demo-quiet' }),
    renderGateButton({ label: 'Delete record', variant: 'destructive', action: 'open-dialog' }),
    renderGateButton({ label: 'Saving', variant: 'primary', loading: true })
  ].join('');

  const persistenceStates = ['saved', 'pending', 'stale', 'conflict', 'failed']
    .map(state => renderGateStatusPill({ state, label: state, live: state !== 'saved' })).join('');

  root.innerHTML = [
    renderGatePageHeader({
      eyebrow: 'Build 2 · Phase 2B',
      title: 'GATE Component Workshop',
      description: 'Inactive reference implementations using the GATE Design Language.',
      status: { state: 'saved', label: 'Workshop loaded' },
      actions: [{ label: 'Open sheet', action: 'open-sheet', variant: 'secondary' }]
    }),
    renderGateCommandBar({
      label: 'Workshop controls',
      context: 'Theme and density controls are outside component data contracts.',
      persistenceState: 'saved',
      persistenceLabel: 'Reference state',
      actions: [{ label: 'Open dialog', action: 'open-dialog', variant: 'secondary' }]
    }),
    section('Buttons and persistence states', 'Action hierarchy and explicit write-state communication.', buttonStates + persistenceStates),
    section('Form fields', 'Labels, help text, validation messages, and programmatic relationships.', [
      renderGateFormField({ id: 'bus-number', label: 'Bus number', value: '12', helpText: 'Use the dispatch identifier.' }),
      renderGateFormField({ id: 'otw-count', label: 'OTW count', type: 'number', value: 51, required: true }),
      renderGateFormField({ id: 'arrival-time', label: 'Arrival time', type: 'datetime-local', errorText: 'Arrival time requires confirmation before save.' })
    ].join('')),
    section('Operational metrics', 'Compact, command, warning, and stale presentations from one contract.', workshopFixtures.metrics.map(renderGateMetricCard).join('')),
    section('Dorm cards', 'Record-identity cards with state, load, timer, service, sex, and assignment context.', workshopFixtures.dorms.map(renderGateDormCard).join('')),
    section('Bus cards', 'Airport and local arrivals use the same information hierarchy.', workshopFixtures.buses.map(renderGateBusCard).join('')),
    section('Data table', 'Captioned, scoped, keyboard-reachable tabular data.', renderGateDataTable(workshopFixtures.table)),
    section('Notifications', 'Non-silent outcomes for save, warning, and failure states.', [
      renderGateNotification({ variant: 'success', title: 'Saved', message: 'Dorm 321 A1 was updated.', dismissible: true }),
      renderGateNotification({ variant: 'warning', title: 'Stale data', message: 'Another tab changed the active Week Group.', action: { label: 'Refresh', action: 'refresh' } }),
      renderGateNotification({ variant: 'error', title: 'Write failed', message: 'The bus arrival was not confirmed. Retry is required.', dismissible: true })
    ].join('')),
    renderGateDialog({
      id: 'workshop-dialog',
      title: 'Confirm destructive action',
      description: 'This reference dialog demonstrates explicit confirmation and visible close controls.',
      body: '<p>Deleting a bus record is permanent and must not occur without confirmation.</p>',
      actions: [
        { label: 'Cancel', action: 'close', variant: 'secondary' },
        { label: 'Confirm delete', action: 'confirm-delete', variant: 'destructive' }
      ]
    }),
    renderGateSheet({
      id: 'workshop-sheet',
      title: 'Dorm detail sheet',
      description: 'The same detail contract can compose as a side, bottom, or full sheet.',
      body: renderGateDormCard(workshopFixtures.dorms[0]),
      actions: [{ label: 'Close', action: 'close', variant: 'secondary' }]
    })
  ].join('');
}

function focusableWithin(container) {
  return [...container.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
}

function closeSheet(sheet) {
  sheet.hidden = true;
  document.documentElement.removeAttribute('data-gate-overlay-open');
  returnFocus?.focus?.();
  returnFocus = null;
}

function openSheet(trigger) {
  const sheet = document.getElementById('workshop-sheet');
  if (!sheet) return;
  returnFocus = trigger;
  sheet.hidden = false;
  document.documentElement.setAttribute('data-gate-overlay-open', 'true');
  focusableWithin(sheet)[0]?.focus();
}

function openDialog(trigger) {
  const dialog = document.getElementById('workshop-dialog');
  if (!dialog) return;
  returnFocus = trigger;
  dialog.showModal();
  dialog.querySelector('[data-gate-action="close"]')?.focus();
}

function closeDialog(dialog) {
  dialog.close();
  returnFocus?.focus?.();
  returnFocus = null;
}

root.addEventListener('click', event => {
  const trigger = event.target.closest('[data-gate-action]');
  if (!trigger) return;
  const action = trigger.dataset.gateAction;
  const dialog = trigger.closest('dialog');
  const sheet = trigger.closest('.gate-sheet');

  if (action === 'open-dialog') openDialog(trigger);
  if (action === 'open-sheet' || action === 'open-dorm') openSheet(trigger);
  if (action === 'close' && dialog) closeDialog(dialog);
  if (action === 'close' && sheet) closeSheet(sheet);
  if (action === 'dismiss') trigger.closest('.gate-notification')?.remove();
});

root.addEventListener('close', event => {
  if (event.target.matches('dialog')) {
    returnFocus?.focus?.();
    returnFocus = null;
  }
}, true);

document.addEventListener('keydown', event => {
  const sheet = document.getElementById('workshop-sheet');
  if (!sheet || sheet.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSheet(sheet);
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = focusableWithin(sheet);
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

document.getElementById('workshop-theme')?.addEventListener('change', event => {
  document.documentElement.dataset.gateTheme = event.target.value;
});

document.getElementById('workshop-density')?.addEventListener('change', event => {
  document.documentElement.dataset.gateDensity = event.target.value;
});

renderWorkshop();
