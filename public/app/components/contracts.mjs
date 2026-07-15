// GATE Design Language component contracts — Build 2 Phase 2B.
// Framework-neutral and inactive until a later migration gate.

const DENSITIES = Object.freeze(['command', 'standard', 'touch']);

function freezeList(values) {
  return Object.freeze([...values]);
}

function defineComponent(name, definition) {
  return Object.freeze({
    name,
    version: '2B.1.0',
    densities: DENSITIES,
    variants: freezeList(definition.variants || ['default']),
    states: freezeList(definition.states || ['default', 'disabled']),
    requiredInputs: freezeList(definition.requiredInputs || []),
    optionalInputs: freezeList(definition.optionalInputs || []),
    events: freezeList(definition.events || []),
    accessibility: Object.freeze({ ...definition.accessibility }),
    responsive: Object.freeze({ ...definition.responsive })
  });
}

export const COMPONENT_NAMES = Object.freeze([
  'GateButton',
  'GateFormField',
  'GateMetricCard',
  'GateStatusPill',
  'GateDormCard',
  'GateBusCard',
  'GateDataTable',
  'GateDialog',
  'GateSheet',
  'GateNotification',
  'GatePageHeader',
  'GateCommandBar'
]);

export const componentContracts = Object.freeze({
  GateButton: defineComponent('GateButton', {
    variants: ['primary', 'secondary', 'quiet', 'destructive'],
    states: ['default', 'hover', 'focus', 'pressed', 'disabled', 'loading'],
    requiredInputs: ['label'],
    optionalInputs: ['icon', 'type', 'disabled', 'loading'],
    events: ['activate'],
    accessibility: { role: 'button', keyboard: ['Enter', 'Space'], visibleFocus: true, accessibleNameRequired: true },
    responsive: { containerAdaptive: false, touchTargetMinimum: 44 }
  }),
  GateFormField: defineComponent('GateFormField', {
    variants: ['text', 'number', 'select', 'textarea', 'datetime'],
    states: ['default', 'focus', 'disabled', 'readonly', 'invalid', 'saving', 'saved'],
    requiredInputs: ['id', 'label'],
    optionalInputs: ['helpText', 'errorText', 'required', 'value'],
    events: ['input', 'change', 'commit'],
    accessibility: { role: 'group', labelAssociationRequired: true, errorDescribedByRequired: true, visibleFocus: true },
    responsive: { containerAdaptive: true, disclosure: 'help and errors remain adjacent to their control' }
  }),
  GateMetricCard: defineComponent('GateMetricCard', {
    variants: ['standard', 'command', 'compact'],
    states: ['default', 'warning', 'failed', 'stale'],
    requiredInputs: ['label', 'value'],
    optionalInputs: ['supportingText', 'state', 'trend'],
    accessibility: { role: 'group', labelValueRelationshipRequired: true, liveRegion: 'off by default' },
    responsive: { containerAdaptive: true, compactBelow: '18rem' }
  }),
  GateStatusPill: defineComponent('GateStatusPill', {
    variants: ['arrived', 'enroute', 'processing', 'closed', 'overtime', 'warning', 'failed', 'saved', 'pending', 'stale', 'conflict'],
    states: ['default'],
    requiredInputs: ['state', 'label'],
    optionalInputs: ['icon'],
    accessibility: { role: 'status when dynamically updated', textRequired: true, colorOnlyProhibited: true },
    responsive: { containerAdaptive: false }
  }),
  GateDormCard: defineComponent('GateDormCard', {
    variants: ['empty', 'open', 'closed'],
    states: ['default', 'selected', 'female', 'band', 'space-force', 'overtime', 'stale'],
    requiredInputs: ['id', 'name', 'state', 'load', 'capacity'],
    optionalInputs: ['timer', 'sex', 'band', 'spaceForce', 'location', 'assignedStaff'],
    events: ['select', 'open', 'close', 'reopen'],
    accessibility: { role: 'article', headingRequired: true, actionNamesRequired: true, colorOnlyProhibited: true },
    responsive: { containerAdaptive: true, stackBelow: '22rem', primaryFactsPersist: ['name', 'state', 'load'] }
  }),
  GateBusCard: defineComponent('GateBusCard', {
    variants: ['airport', 'local'],
    states: ['active', 'arrived', 'selected', 'stale'],
    requiredInputs: ['id', 'label', 'status', 'total'],
    optionalInputs: ['female', 'naturalization', 'spaceForce', 'departureTime', 'arrivalTime'],
    events: ['select', 'confirm-arrival', 'edit'],
    accessibility: { role: 'article', headingRequired: true, actionNamesRequired: true, colorOnlyProhibited: true },
    responsive: { containerAdaptive: true, horizontalAbove: '28rem' }
  }),
  GateDataTable: defineComponent('GateDataTable', {
    variants: ['standard', 'compact', 'read-only'],
    states: ['default', 'loading', 'empty', 'failed'],
    requiredInputs: ['caption', 'columns', 'rows'],
    optionalInputs: ['sortable', 'selectable', 'stickyHeader'],
    events: ['sort', 'select-row', 'activate-row'],
    accessibility: { role: 'table', captionRequired: true, headerScopeRequired: true, keyboardRowActionsRequired: true },
    responsive: { containerAdaptive: true, overflow: 'controlled horizontal scrolling without hiding headers' }
  }),
  GateDialog: defineComponent('GateDialog', {
    variants: ['standard', 'critical'],
    states: ['closed', 'open', 'saving', 'failed'],
    requiredInputs: ['id', 'title'],
    optionalInputs: ['description', 'primaryAction', 'secondaryAction'],
    events: ['open', 'close', 'confirm', 'cancel'],
    accessibility: { role: 'dialog', ariaModal: true, focusTrapRequired: true, escapeCloses: true, focusReturnRequired: true, visibleCloseRequired: true },
    responsive: { containerAdaptive: true, phoneComposition: 'near-full-screen' }
  }),
  GateSheet: defineComponent('GateSheet', {
    variants: ['side', 'bottom', 'full'],
    states: ['closed', 'open', 'saving', 'failed'],
    requiredInputs: ['id', 'title'],
    optionalInputs: ['description', 'placement'],
    events: ['open', 'close', 'commit'],
    accessibility: { role: 'dialog', ariaModal: true, focusTrapRequired: true, escapeCloses: true, focusReturnRequired: true, visibleCloseRequired: true },
    responsive: { containerAdaptive: true, placementMayAdapt: true }
  }),
  GateNotification: defineComponent('GateNotification', {
    variants: ['info', 'success', 'warning', 'error'],
    states: ['visible', 'dismissed'],
    requiredInputs: ['message'],
    optionalInputs: ['title', 'dismissible', 'action'],
    events: ['dismiss', 'activate-action'],
    accessibility: { role: 'status or alert by urgency', liveRegionRequired: true, dismissNameRequired: true },
    responsive: { containerAdaptive: true, placement: 'non-blocking unless critical' }
  }),
  GatePageHeader: defineComponent('GatePageHeader', {
    variants: ['standard', 'command', 'compact'],
    states: ['default'],
    requiredInputs: ['title'],
    optionalInputs: ['eyebrow', 'description', 'actions', 'status'],
    accessibility: { role: 'banner within page region', headingLevelRequired: true, landmarkDuplicationAvoided: true },
    responsive: { containerAdaptive: true, actionsWrapBelow: '36rem' }
  }),
  GateCommandBar: defineComponent('GateCommandBar', {
    variants: ['page', 'selection', 'display'],
    states: ['default', 'saving', 'offline', 'conflict'],
    requiredInputs: ['label'],
    optionalInputs: ['actions', 'context', 'persistenceState'],
    events: ['activate-action'],
    accessibility: { role: 'toolbar', accessibleNameRequired: true, rovingTabindexRecommended: true, visibleFocus: true },
    responsive: { containerAdaptive: true, overflow: 'priority actions remain visible; secondary actions disclose' }
  })
});

export function getComponentContract(name) {
  return componentContracts[name] || null;
}

export function validateComponentContracts(contracts = componentContracts) {
  const errors = [];
  for (const name of COMPONENT_NAMES) {
    const contract = contracts[name];
    if (!contract) {
      errors.push(`Missing component contract: ${name}`);
      continue;
    }
    if (contract.version !== '2B.1.0') errors.push(`${name} has an unexpected contract version.`);
    if (contract.densities.join('|') !== DENSITIES.join('|')) errors.push(`${name} must support command, standard, and touch density.`);
    if (!contract.accessibility || Object.keys(contract.accessibility).length === 0) errors.push(`${name} requires an accessibility contract.`);
    if (!contract.responsive || Object.keys(contract.responsive).length === 0) errors.push(`${name} requires a responsive contract.`);
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
