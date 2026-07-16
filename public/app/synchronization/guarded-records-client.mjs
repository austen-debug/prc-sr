import {
  GateRepositoryError,
  RepositoryErrorCode,
  repositoryFailure
} from '../data/repository-result.mjs';
import { canPerformCriticalWrite } from './sync-state.mjs';

function blocked(state, operation) {
  return repositoryFailure(new GateRepositoryError(
    RepositoryErrorCode.DEGRADED_READ_ONLY,
    'Critical writes are unavailable until authoritative synchronization succeeds.',
    {
      retryable: true,
      details: Object.freeze({
        operation,
        syncStatus: state?.status || 'unknown',
        online: state?.online === true,
        stale: state?.stale !== false,
        lastSyncedAt: state?.lastSyncedAt || null,
        queued: false
      })
    }
  ), {
    degradedOperation: true,
    queued: false
  });
}

export function createGuardedRecordsClient({ client, getSyncState } = {}) {
  if (!client) throw new TypeError('A records client is required.');
  if (typeof getSyncState !== 'function') throw new TypeError('A synchronization state reader is required.');

  function allow(operation, execute) {
    const state = getSyncState();
    if (!canPerformCriticalWrite(state)) return Promise.resolve(blocked(state, operation));
    return execute();
  }

  return Object.freeze({
    capabilities: Object.freeze({
      ...(client.capabilities || {}),
      degradedOperationGuard: true,
      offlineWriteQueue: false
    }),
    list: (...args) => client.list(...args),
    create: (...args) => allow('create', () => client.create(...args)),
    update: (...args) => allow('update', () => client.update(...args)),
    delete: (...args) => allow('delete', () => client.delete(...args))
  });
}
