import { POSTURE_IDS, getPosture } from '../responsive/posture-registry.mjs';
import { freezeShadow, STATUS_BOARD_SHADOW_VERSION } from './contracts.mjs';

const composition = (definition) => freezeShadow(definition);

export const STATUS_BOARD_POSTURE_CONTRACTS = Object.freeze({
  'desktop-landscape': composition({ metricColumns: 4, dormPresentation: 'three-columns', activeBusPresentation: 'horizontal-lane', density: 'command', fullscreen: 'command-display' }),
  'desktop-vertical': composition({ metricColumns: 2, dormPresentation: 'stacked-state-regions', activeBusPresentation: 'wrapped-lane', density: 'standard', fullscreen: 'portrait-display' }),
  'tablet-landscape': composition({ metricColumns: 4, dormPresentation: 'three-columns-scroll-safe', activeBusPresentation: 'horizontal-lane', density: 'standard', fullscreen: 'touch-display' }),
  'tablet-portrait': composition({ metricColumns: 2, dormPresentation: 'stacked-state-regions', activeBusPresentation: 'horizontal-scroll', density: 'touch', fullscreen: 'touch-display' }),
  'phone-landscape': composition({ metricColumns: 2, dormPresentation: 'stacked-state-regions', activeBusPresentation: 'horizontal-scroll', density: 'touch', fullscreen: 'compact-display' }),
  'phone-portrait': composition({ metricColumns: 1, dormPresentation: 'stacked-state-regions', activeBusPresentation: 'horizontal-scroll', density: 'touch', fullscreen: 'compact-display' })
});

export const STATUS_BOARD_ACCESSIBILITY_CONTRACT = freezeShadow({
  standard: 'WCAG 2.2 AA',
  landmarks: ['banner', 'navigation', 'main'],
  routeHeading: 'Status Board',
  metricLabels: ['Arrived', 'Expected', 'Last Arrival', 'Local Time'],
  activeBusRegionLabel: 'Active buses en route',
  dormRegionHeadings: ['Empty', 'Open', 'Closed'],
  timerBehavior: {
    visibleText: true,
    automaticAnnouncement: false,
    reason: 'Frequently changing timers remain visible without continuously interrupting assistive technology.'
  },
  degradedStateAnnouncement: {
    role: 'status',
    includesLastSynchronizedTime: true,
    identifiesReadOnlyState: true
  },
  focus: {
    visible: true,
    orderFollowsReadingOrder: true,
    restorationAfterFullscreenExit: true
  }
});

export const STATUS_BOARD_FULLSCREEN_CONTRACT = freezeShadow({
  supportedPostures: [...POSTURE_IDS],
  visibleEntryControl: true,
  visibleExitControl: true,
  escapeExits: true,
  focusRestoration: true,
  orientationLock: false,
  routeOnly: true,
  noNavigationMutation: true
});

export function buildStatusBoardRouteReadinessEvidence() {
  return freezeShadow({
    contractVersion: STATUS_BOARD_SHADOW_VERSION,
    route: 'board',
    shadowOnly: true,
    productionRouteActivated: false,
    postures: POSTURE_IDS.map(id => ({
      posture: getPosture(id),
      statusBoard: STATUS_BOARD_POSTURE_CONTRACTS[id]
    })),
    accessibility: STATUS_BOARD_ACCESSIBILITY_CONTRACT,
    fullscreen: STATUS_BOARD_FULLSCREEN_CONTRACT,
    manualEvidenceRequiredBeforeActivation: [
      'screen-reader route review',
      'keyboard and focus review',
      'six-posture visual capture',
      'fullscreen entry, exit, and focus restoration',
      'stale and offline presentation review'
    ]
  });
}

export function validateStatusBoardRouteContract() {
  const errors = [];
  const keys = Object.keys(STATUS_BOARD_POSTURE_CONTRACTS);
  for (const posture of POSTURE_IDS) {
    if (!keys.includes(posture)) errors.push(`Missing Status Board posture contract: ${posture}`);
    const contract = STATUS_BOARD_POSTURE_CONTRACTS[posture];
    if (!contract || contract.metricColumns < 1) errors.push(`${posture} requires at least one metric column.`);
    if (!contract?.dormPresentation) errors.push(`${posture} requires a dorm presentation.`);
    if (!contract?.activeBusPresentation) errors.push(`${posture} requires an active-bus presentation.`);
    if (!contract?.fullscreen) errors.push(`${posture} requires a fullscreen presentation.`);
  }
  if (keys.length !== POSTURE_IDS.length) errors.push('Status Board route contract must define exactly six posture compositions.');
  if (STATUS_BOARD_FULLSCREEN_CONTRACT.supportedPostures.length !== POSTURE_IDS.length) errors.push('Fullscreen contract must cover all six postures.');
  if (!STATUS_BOARD_ACCESSIBILITY_CONTRACT.degradedStateAnnouncement.includesLastSynchronizedTime) errors.push('Degraded state must include last-synchronized context.');
  return freezeShadow({ valid: errors.length === 0, errors });
}
