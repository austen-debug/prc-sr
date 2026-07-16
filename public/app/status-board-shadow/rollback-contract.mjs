import { freezeShadow } from './contracts.mjs';

export const STATUS_BOARD_SHADOW_ROLLBACK_CONTRACT = freezeShadow({
  contractVersion: '3A-RB.1.0',
  objective: 'Return immediately to Build 1-only Status Board execution without changing operational records or route ownership.',
  triggerConditions: [
    'shadow bridge causes a runtime error',
    'shadow evaluation degrades Build 1 rendering or responsiveness',
    'diagnostic output exposes prohibited data',
    'unexpected network, storage, route, or service-worker behavior is detected'
  ],
  steps: [
    'Remove the gate-status-board-shadow-controller.js asset from UI_HEAD_SCRIPTS in functions/_middleware.js.',
    'Deploy the middleware-only rollback through the approved path.',
    'Confirm window.GateStatusBoardShadow is absent after a clean reload.',
    'Confirm GateStatusBoardController remains the visible Status Board owner.',
    'Run the Build 1 Status Board smoke checks for metrics, active buses, dorm columns, and timers.',
    'Confirm no Build 2 route, feature flag, service worker, or persistence owner was introduced.',
    'Retain the deployment reference, timestamp, environment, and smoke-test result.'
  ],
  recordSafety: {
    operationalWritesRequired: false,
    schemaChangeRequired: false,
    dataMigrationRequired: false,
    cacheClearRequired: false
  },
  recoveryTarget: 'Build 1-only Status Board execution',
  maximumComplexity: 'single middleware asset removal and deployment'
});

export function validateStatusBoardRollbackContract(contract = STATUS_BOARD_SHADOW_ROLLBACK_CONTRACT) {
  const errors = [];
  if (!contract?.steps?.length) errors.push('Rollback contract requires ordered steps.');
  if (!contract?.steps?.some(step => step.includes('gate-status-board-shadow-controller.js'))) errors.push('Rollback must identify the active shadow bridge asset.');
  if (contract?.recordSafety?.operationalWritesRequired !== false) errors.push('Rollback may not require an operational write.');
  if (contract?.recordSafety?.schemaChangeRequired !== false) errors.push('Rollback may not require a schema change.');
  if (contract?.recordSafety?.dataMigrationRequired !== false) errors.push('Rollback may not require a data migration.');
  if (contract?.recoveryTarget !== 'Build 1-only Status Board execution') errors.push('Rollback target must be Build 1-only execution.');
  return freezeShadow({ valid: errors.length === 0, errors });
}
