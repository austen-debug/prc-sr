import { buildCanonicalStatusBoardSnapshot } from './canonical-snapshot.mjs';
import { compareStatusBoardSnapshots } from './parity.mjs';
import { freezeShadow, shadowText, STATUS_BOARD_SHADOW_VERSION } from './contracts.mjs';

export function runStatusBoardShadow({
  legacySnapshot,
  records = [],
  weekGroup = '',
  capturedAt = '',
  timeZone = 'America/Chicago'
} = {}) {
  const normalizedWeekGroup = shadowText(weekGroup || legacySnapshot?.weekGroup).toUpperCase();
  if (!legacySnapshot || !normalizedWeekGroup) {
    return freezeShadow({
      contractVersion: STATUS_BOARD_SHADOW_VERSION,
      mode: 'shadow',
      readOnly: true,
      productionRouteActivated: false,
      weekGroup: normalizedWeekGroup,
      capturedAt: shadowText(capturedAt),
      status: 'unavailable',
      comparison: compareStatusBoardSnapshots({ legacy: legacySnapshot, canonical: null })
    });
  }

  const canonicalSnapshot = buildCanonicalStatusBoardSnapshot({
    records,
    weekGroup: normalizedWeekGroup,
    capturedAt,
    timeZone
  });
  const comparison = compareStatusBoardSnapshots({ legacy: legacySnapshot, canonical: canonicalSnapshot });

  return freezeShadow({
    contractVersion: STATUS_BOARD_SHADOW_VERSION,
    mode: 'shadow',
    readOnly: true,
    productionRouteActivated: false,
    weekGroup: normalizedWeekGroup,
    capturedAt: shadowText(capturedAt),
    status: comparison.status,
    legacySnapshot,
    canonicalSnapshot,
    comparison
  });
}
