import {
  renderGateButton,
  renderGateDataTable,
  renderGateDialog,
  renderGateNotification,
  renderGateSheet,
  renderGateStatusPill
} from '../../components/index.mjs';
import {
  ACCESSIBLE_STATE_PRESENTATIONS,
  createGateAnnouncer,
  createGateOverlayController
} from '../index.mjs';

const actions = document.getElementById('accessibility-actions');
const states = document.getElementById('accessibility-states');
const reflow = document.getElementById('accessibility-reflow');
const overlays = document.getElementById('accessibility-overlays');
const overlayController = createGateOverlayController({ documentRef: document });
const announcer = createGateAnnouncer({ documentRef: document });

actions.innerHTML = [
  renderGateButton({ label: 'Open confirmation dialog', action: 'open-dialog', variant: 'primary' }),
  renderGateButton({ label: 'Open detail sheet', action: 'open-sheet', variant: 'secondary' }),
  renderGateButton({ label: 'Announce saved state', action: 'announce-saved', variant: 'quiet' }),
  renderGateButton({ label: 'Announce blocking failure', action: 'announce-failure', variant: 'destructive' })
].join('');

states.innerHTML = Object.entries(ACCESSIBLE_STATE_PRESENTATIONS)
  .map(([state, presentation]) => renderGateStatusPill({ state, label: `${presentation.symbol} ${presentation.label}` }))
  .join('');

reflow.innerHTML = renderGateDataTable({
  caption: 'Accessible reflow reference',
  columns: [
    { key: 'state', label: 'State' },
    { key: 'meaning', label: 'Visible meaning' },
    { key: 'announcement', label: 'Announcement behavior' }
  ],
  rows: [
    { state: 'Saved', meaning: 'Text and check marker', announcement: 'Polite' },
    { state: 'Conflict', meaning: 'Text and warning marker', announcement: 'Assertive when blocking' },
    { state: 'Offline', meaning: 'Text and last-sync context', announcement: 'Polite' }
  ]
});

overlays.innerHTML = [
  renderGateDialog({
    id: 'accessibility-dialog',
    title: 'Confirm operational action',
    description: 'Focus remains inside this dialog until it closes.',
    body: renderGateNotification({ variant: 'warning', title: 'Review required', message: 'Confirm the record and Week Group before continuing.' }),
    actions: [
      { label: 'Cancel', action: 'close', variant: 'secondary' },
      { label: 'Confirm', action: 'confirm', variant: 'primary' }
    ]
  }),
  renderGateSheet({
    id: 'accessibility-sheet',
    title: 'Accessible detail sheet',
    description: 'Escape closes this sheet and focus returns to the opening control.',
    body: '<p>All information remains available through text, structure, and keyboard navigation.</p>',
    actions: [{ label: 'Close', action: 'close', variant: 'secondary' }]
  })
].join('');

document.addEventListener('click', event => {
  const control = event.target.closest('[data-gate-action]');
  if (!control) return;
  const action = control.dataset.gateAction;
  if (action === 'open-dialog') overlayController.open(document.getElementById('accessibility-dialog'), control);
  if (action === 'open-sheet') overlayController.open(document.getElementById('accessibility-sheet'), control);
  if (action === 'announce-saved') announcer.announce({ message: 'Changes saved.', urgency: 'polite' });
  if (action === 'announce-failure') announcer.announce({ message: 'Save failed. Retry is required.', urgency: 'assertive' });
  if (action === 'confirm') {
    announcer.announce({ message: 'Action confirmed.', urgency: 'polite' });
    overlayController.close(control.closest('[data-gate-overlay]'));
  }
});

document.getElementById('accessibility-theme')?.addEventListener('change', event => {
  document.documentElement.dataset.gateTheme = event.target.value;
});

document.getElementById('accessibility-density')?.addEventListener('change', event => {
  document.documentElement.dataset.gateDensity = event.target.value;
});
