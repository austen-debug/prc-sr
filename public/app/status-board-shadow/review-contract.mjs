import { POSTURE_IDS } from '../responsive/posture-registry.mjs';
import { freezeShadow } from './contracts.mjs';

export const STATUS_BOARD_EVIDENCE_REVIEW_VERSION = '3A-R.1.0';

export const STATUS_BOARD_REVIEW_STATUSES = Object.freeze([
  'collecting',
  'blocked',
  'ready-for-authorization-review'
]);

export const STATUS_BOARD_REVIEW_POLICY = freezeShadow({
  liveParity: {
    minimumSamples: 10,
    minimumConsecutivePassing: 5,
    minimumObservationMs: 270000,
    zeroBlockingMetrics: true
  },
  authorization: {
    explicitDecisionRequired: true,
    phase3BAuthorizedByEvaluator: false,
    productionActivationAuthorizedByEvaluator: false
  }
});

const manualCheck = (definition) => freezeShadow({ required: true, ...definition });

export const STATUS_BOARD_MANUAL_CHECKS = Object.freeze([
  ...POSTURE_IDS.map(posture => manualCheck({
    id: `responsive.${posture}`,
    category: 'responsive',
    posture,
    label: `${posture} visual composition, overflow, readability, and touch-target review`
  })),
  manualCheck({ id: 'accessibility.keyboard-route', category: 'accessibility', label: 'Keyboard-only route traversal and operation' }),
  manualCheck({ id: 'accessibility.focus-visible-order', category: 'accessibility', label: 'Visible focus, logical order, and no focus loss' }),
  manualCheck({ id: 'accessibility.landmarks-headings-labels', category: 'accessibility', label: 'Landmarks, heading hierarchy, regions, and labels' }),
  manualCheck({ id: 'accessibility.screen-reader', category: 'accessibility', label: 'Screen-reader route comprehension and timer behavior' }),
  manualCheck({ id: 'accessibility.contrast-forced-colors', category: 'accessibility', label: 'Contrast and forced-colors review' }),
  manualCheck({ id: 'accessibility.zoom-reflow', category: 'accessibility', label: '200% and 400% zoom/reflow review' }),
  manualCheck({ id: 'accessibility.touch-targets', category: 'accessibility', label: 'Touch-target sizing and spacing review' }),
  manualCheck({ id: 'fullscreen.entry-exit', category: 'fullscreen', label: 'Visible fullscreen entry and exit controls' }),
  manualCheck({ id: 'fullscreen.escape', category: 'fullscreen', label: 'Escape exits fullscreen' }),
  manualCheck({ id: 'fullscreen.focus-restoration', category: 'fullscreen', label: 'Focus returns to the initiating control' }),
  manualCheck({ id: 'fullscreen.route-isolation', category: 'fullscreen', label: 'Fullscreen remains route-only and does not mutate navigation' }),
  manualCheck({ id: 'degraded.stale-readonly', category: 'degraded-operation', label: 'Stale state is visible and read-only' }),
  manualCheck({ id: 'degraded.offline-readonly', category: 'degraded-operation', label: 'Offline state is visible and read-only' }),
  manualCheck({ id: 'degraded.last-sync', category: 'degraded-operation', label: 'Last synchronized time is visible and understandable' }),
  manualCheck({ id: 'degraded.reconnect-refresh', category: 'degraded-operation', label: 'Reconnect performs authoritative refresh and clears stale state' }),
  manualCheck({ id: 'rollback.disable-shadow-asset', category: 'rollback', label: 'Shadow bridge can be disabled without changing Build 1' }),
  manualCheck({ id: 'rollback.build1-smoke', category: 'rollback', label: 'Build 1 Status Board smoke test passes after shadow removal' }),
  manualCheck({ id: 'rollback.no-residual-route', category: 'rollback', label: 'No Build 2 route, flag, or service worker remains after rollback' })
]);

export const STATUS_BOARD_MANUAL_CHECK_IDS = Object.freeze(STATUS_BOARD_MANUAL_CHECKS.map(check => check.id));

export const STATUS_BOARD_DEPLOYMENT_PREREQUISITES = Object.freeze([
  freezeShadow({ id: 'controlled-environment-identified', label: 'Controlled evidence environment identified' }),
  freezeShadow({ id: 'read-only-records-path-verified', label: 'Authoritative read-only records path verified' }),
  freezeShadow({ id: 'session-role-bindings-verified', label: 'Session secret and route role bindings verified' }),
  freezeShadow({ id: 'feature-flag-default-off', label: 'Any controlled test-surface flag defaults off' }),
  freezeShadow({ id: 'rollback-path-exercised', label: 'Route rollback path exercised in the controlled environment' }),
  freezeShadow({ id: 'service-worker-remains-inactive', label: 'Build 2 service worker remains inactive' }),
  freezeShadow({ id: 'manual-accessibility-evidence-retained', label: 'Manual accessibility evidence retained' }),
  freezeShadow({ id: 'manual-responsive-evidence-retained', label: 'Manual six-posture evidence retained' })
]);

export const STATUS_BOARD_DEPLOYMENT_PREREQUISITE_IDS = Object.freeze(
  STATUS_BOARD_DEPLOYMENT_PREREQUISITES.map(item => item.id)
);
