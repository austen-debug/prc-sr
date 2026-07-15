// GATE Build 2 Phase 2E — framework-neutral accessibility contracts.

export const ACCESSIBILITY_STANDARD = 'WCAG 2.2 AA';
export const MINIMUM_TOUCH_TARGET = 44;

export const ACCESSIBILITY_REQUIREMENTS = Object.freeze({
  keyboard: Object.freeze({
    allActionsOperable: true,
    logicalFocusOrder: true,
    noKeyboardTrap: true,
    escapeClosesOverlays: true,
    focusReturnRequired: true
  }),
  focus: Object.freeze({
    visibleIndicatorRequired: true,
    minimumIndicatorThickness: 2,
    obscuredFocusProhibited: true
  }),
  touch: Object.freeze({
    minimumTarget: MINIMUM_TOUCH_TARGET,
    spacingOrEquivalentRequired: true,
    hoverOnlyActionsProhibited: true
  }),
  overlays: Object.freeze({
    accessibleNameRequired: true,
    ariaModalRequired: true,
    initialFocusRequired: true,
    containedFocusRequired: true,
    visibleCloseRequired: true,
    inertBackgroundRequired: true
  }),
  status: Object.freeze({
    politeForRoutine: true,
    assertiveForBlockingFailure: true,
    visibleTextRequired: true,
    colorOnlyProhibited: true
  }),
  presentation: Object.freeze({
    reducedMotionRequired: true,
    forcedColorsRequired: true,
    zoom200Required: true,
    reflow320CssPixelsRequired: true,
    textSpacingResilient: true
  })
});

export const ACCESSIBLE_STATE_PRESENTATIONS = Object.freeze({
  arrived: Object.freeze({ label: 'Arrived', symbol: '✓', urgency: 'routine' }),
  enroute: Object.freeze({ label: 'En route', symbol: '→', urgency: 'routine' }),
  processing: Object.freeze({ label: 'Processing', symbol: '…', urgency: 'routine' }),
  closed: Object.freeze({ label: 'Closed', symbol: '■', urgency: 'routine' }),
  overtime: Object.freeze({ label: 'Overtime', symbol: '!', urgency: 'warning' }),
  warning: Object.freeze({ label: 'Warning', symbol: '!', urgency: 'warning' }),
  failed: Object.freeze({ label: 'Failed', symbol: '×', urgency: 'blocking' }),
  saved: Object.freeze({ label: 'Saved', symbol: '✓', urgency: 'routine' }),
  pending: Object.freeze({ label: 'Pending', symbol: '…', urgency: 'routine' }),
  stale: Object.freeze({ label: 'Stale', symbol: '↻', urgency: 'warning' }),
  conflict: Object.freeze({ label: 'Conflict', symbol: '!', urgency: 'blocking' })
});

export const OVERLAY_KINDS = Object.freeze(['dialog', 'sheet']);
export const LIVE_REGION_POLITENESS = Object.freeze(['polite', 'assertive']);

export function getAccessibleStatePresentation(state) {
  return ACCESSIBLE_STATE_PRESENTATIONS[String(state || '').toLowerCase()] || null;
}

export function validateAccessibilityContracts() {
  const errors = [];
  if (ACCESSIBILITY_STANDARD !== 'WCAG 2.2 AA') errors.push('Accessibility standard must remain WCAG 2.2 AA.');
  if (MINIMUM_TOUCH_TARGET < 44) errors.push('Minimum touch target must be at least 44 CSS pixels.');
  for (const [state, presentation] of Object.entries(ACCESSIBLE_STATE_PRESENTATIONS)) {
    if (!presentation.label) errors.push(`${state} requires visible text.`);
    if (!presentation.symbol) errors.push(`${state} requires a non-color symbol.`);
    if (!['routine', 'warning', 'blocking'].includes(presentation.urgency)) errors.push(`${state} has invalid urgency.`);
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
