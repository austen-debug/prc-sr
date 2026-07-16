import { appendShadowEvidence, createShadowEvidenceLedger, summarizeShadowEvidence } from './evidence-ledger.mjs';
import { runStatusBoardShadow } from './runner.mjs';
import { freezeShadow, shadowText, STATUS_BOARD_SHADOW_VERSION } from './contracts.mjs';

export function createStatusBoardShadowSyncAdapter({
  coordinator,
  captureLegacySnapshot,
  weekGroup,
  now = () => new Date().toISOString(),
  timeZone = 'America/Chicago'
} = {}) {
  if (!coordinator || typeof coordinator.start !== 'function' || typeof coordinator.subscribe !== 'function') {
    throw new TypeError('A synchronization coordinator is required.');
  }
  if (typeof captureLegacySnapshot !== 'function') throw new TypeError('A legacy Status Board snapshot capture function is required.');

  let latest = null;
  let evidence = createShadowEvidenceLedger();
  let unsubscribe = null;
  let evaluatedSnapshotVersion = -1;
  let pending = Promise.resolve(null);

  function resolveWeekGroup(snapshot) {
    const value = typeof weekGroup === 'function' ? weekGroup(snapshot) : weekGroup;
    return shadowText(value).toUpperCase();
  }

  async function evaluate(reason = 'manual') {
    const state = coordinator.getState();
    const snapshot = coordinator.readSnapshot();
    if (state?.status !== 'current' || state?.authoritative !== true || snapshot?.stale === true) {
      return freezeShadow({ ok: false, reason: 'not_authoritative', state, snapshotVersion: snapshot?.version ?? 0 });
    }
    if (snapshot?.version === evaluatedSnapshotVersion && reason !== 'manual') {
      return freezeShadow({ ok: true, unchanged: true, latest, snapshotVersion: snapshot.version });
    }

    const capturedAt = shadowText(typeof now === 'function' ? now() : now);
    const legacySnapshot = await captureLegacySnapshot({ state, snapshot, capturedAt });
    latest = runStatusBoardShadow({
      legacySnapshot,
      records: snapshot.records,
      weekGroup: resolveWeekGroup(snapshot),
      capturedAt,
      timeZone
    });
    evidence = appendShadowEvidence(evidence, latest.comparison);
    evaluatedSnapshotVersion = snapshot.version;
    return freezeShadow({ ok: true, reason, latest, snapshotVersion: snapshot.version });
  }

  function queueEvaluation(reason) {
    pending = pending.then(() => evaluate(reason));
    return pending;
  }

  function onSyncState(state, previous, event) {
    if (state?.status === 'current' && state?.authoritative === true && previous !== state) {
      void queueEvaluation(event?.type || 'sync.succeeded');
    }
  }

  return Object.freeze({
    contractVersion: STATUS_BOARD_SHADOW_VERSION,
    mode: 'shadow',
    readOnly: true,

    async start() {
      if (!unsubscribe) unsubscribe = coordinator.subscribe(onSyncState);
      const result = await coordinator.start();
      if (result?.ok && coordinator.getState()?.status === 'current') await queueEvaluation('startup');
      return freezeShadow({ ...result, latest });
    },

    stop() {
      unsubscribe?.();
      unsubscribe = null;
      coordinator.stop?.();
    },

    evaluate,

    whenIdle() {
      return pending;
    },

    getLatest() {
      return latest;
    },

    getEvidence() {
      return evidence;
    },

    getEvidenceSummary(options) {
      return summarizeShadowEvidence(evidence, options);
    }
  });
}
