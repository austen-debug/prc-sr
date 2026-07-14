import {
  normalizePersistedRecord,
  normalizePersistedRecords
} from './record-normalizer.mjs';
import {
  GateRepositoryError,
  RepositoryErrorCode,
  repositoryErrorFromResponse,
  repositoryFailure,
  repositoryOk
} from './repository-result.mjs';

export const BUILD_1_RECORDS_API_CAPABILITIES = Object.freeze({
  recordVersioning: false,
  conditionalWrites: false,
  transactions: false,
  batchWrites: false
});

function assertTransport(transport) {
  const required = ['list', 'create', 'update', 'delete'];
  const missing = required.filter(name => typeof transport?.[name] !== 'function');
  if (missing.length) {
    throw new TypeError(`Records transport is missing: ${missing.join(', ')}.`);
  }
}

function normalizeTransportResponse(response) {
  if (!response || typeof response !== 'object') {
    return {
      ok: false,
      status: 0,
      body: { isOk: false, error: 'Records transport returned no response.' }
    };
  }

  const body = response.body && typeof response.body === 'object' ? response.body : {};
  const status = Number(response.status || 0);
  const ok = response.ok === true || (status >= 200 && status < 300 && body.isOk !== false);
  return { ok, status, body, headers: response.headers || null };
}

async function execute(operation) {
  try {
    return normalizeTransportResponse(await operation());
  } catch (error) {
    throw new GateRepositoryError(
      RepositoryErrorCode.NETWORK,
      error?.message || 'Unable to reach the records service.',
      { retryable: true, cause: error }
    );
  }
}

export function createRecordsClient({ transport, timeZone = 'America/Chicago' } = {}) {
  assertTransport(transport);
  const capabilities = Object.freeze({
    ...BUILD_1_RECORDS_API_CAPABILITIES,
    ...(transport.capabilities || {})
  });

  async function list() {
    try {
      const response = await execute(() => transport.list());
      if (!response.ok || response.body.isOk === false) return repositoryFailure(repositoryErrorFromResponse(response));
      const normalized = normalizePersistedRecords(response.body.records || [], { timeZone });
      return repositoryOk(normalized, { capabilities, source: 'records-api' });
    } catch (error) {
      return repositoryFailure(error);
    }
  }

  async function create(rawRecord) {
    try {
      const response = await execute(() => transport.create(rawRecord));
      if (!response.ok || response.body.isOk === false) return repositoryFailure(repositoryErrorFromResponse(response));
      const record = response.body.data || rawRecord;
      return repositoryOk(normalizePersistedRecord(record, { timeZone }), { capabilities, source: 'records-api' });
    } catch (error) {
      return repositoryFailure(error);
    }
  }

  async function update(rawRecord, options = {}) {
    const expectedRecordVersion = Number(options.expectedRecordVersion);
    const requiresConflictDetection = Boolean(options.requireConflictDetection);

    if (requiresConflictDetection && !capabilities.recordVersioning) {
      return repositoryFailure(new GateRepositoryError(
        RepositoryErrorCode.CONFLICT_DETECTION_UNAVAILABLE,
        'The active records API does not yet enforce record-version conflicts.',
        { details: { expectedRecordVersion: Number.isFinite(expectedRecordVersion) ? expectedRecordVersion : null } }
      ));
    }

    try {
      const response = await execute(() => transport.update(rawRecord, {
        expectedRecordVersion: capabilities.conditionalWrites && Number.isFinite(expectedRecordVersion)
          ? expectedRecordVersion
          : null
      }));
      if (!response.ok || response.body.isOk === false) return repositoryFailure(repositoryErrorFromResponse(response));
      const record = response.body.data || rawRecord;
      return repositoryOk(normalizePersistedRecord(record, { timeZone }), { capabilities, source: 'records-api' });
    } catch (error) {
      return repositoryFailure(error);
    }
  }

  async function remove(recordOrId, options = {}) {
    const rawRecord = typeof recordOrId === 'string'
      ? { __backendId: recordOrId }
      : recordOrId;
    const expectedRecordVersion = Number(options.expectedRecordVersion);
    const requiresConflictDetection = Boolean(options.requireConflictDetection);

    if (requiresConflictDetection && !capabilities.recordVersioning) {
      return repositoryFailure(new GateRepositoryError(
        RepositoryErrorCode.CONFLICT_DETECTION_UNAVAILABLE,
        'The active records API does not yet enforce record-version conflicts.',
        { details: { expectedRecordVersion: Number.isFinite(expectedRecordVersion) ? expectedRecordVersion : null } }
      ));
    }

    try {
      const response = await execute(() => transport.delete(rawRecord, {
        expectedRecordVersion: capabilities.conditionalWrites && Number.isFinite(expectedRecordVersion)
          ? expectedRecordVersion
          : null
      }));
      if (!response.ok || response.body.isOk === false) return repositoryFailure(repositoryErrorFromResponse(response));
      return repositoryOk({ id: rawRecord?.__backendId || rawRecord?.id || '' }, { capabilities, source: 'records-api' });
    } catch (error) {
      return repositoryFailure(error);
    }
  }

  return Object.freeze({
    capabilities,
    list,
    create,
    update,
    delete: remove
  });
}

async function parseResponse(response) {
  let body = {};
  try {
    body = await response.json();
  } catch (_) {
    body = { isOk: false, error: 'Records API returned a non-JSON response.' };
  }
  return { ok: response.ok, status: response.status, body, headers: response.headers };
}

export function createFetchRecordsTransport({
  fetchImpl = globalThis.fetch,
  endpoint = '/api/records',
  credentials = 'same-origin'
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');

  async function request(method, body, options = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (Number.isFinite(options.expectedRecordVersion)) headers['If-Match'] = String(options.expectedRecordVersion);

    const response = await fetchImpl(endpoint, {
      method,
      credentials,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    return parseResponse(response);
  }

  return Object.freeze({
    capabilities: BUILD_1_RECORDS_API_CAPABILITIES,
    list: () => request('GET'),
    create: record => request('POST', record),
    update: (record, options) => request('PUT', record, options),
    delete: (record, options) => request('DELETE', record, options)
  });
}
