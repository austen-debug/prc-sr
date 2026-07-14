export const RepositoryErrorCode = Object.freeze({
  VALIDATION: 'validation_error',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  CONFLICT_DETECTION_UNAVAILABLE: 'conflict_detection_unavailable',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NETWORK: 'network_error',
  TRANSPORT: 'transport_error',
  PERSISTENCE: 'persistence_error',
  UNSUPPORTED: 'unsupported_operation'
});

export class GateRepositoryError extends Error {
  constructor(code, message, options = {}) {
    super(String(message || 'Repository operation failed.'));
    this.name = 'GateRepositoryError';
    this.code = code || RepositoryErrorCode.PERSISTENCE;
    this.status = Number.isFinite(options.status) ? options.status : null;
    this.retryable = Boolean(options.retryable);
    this.details = options.details ?? null;
    this.cause = options.cause;
  }
}

export function repositoryOk(data, meta = {}) {
  return Object.freeze({
    ok: true,
    data,
    error: null,
    meta: Object.freeze({ ...meta })
  });
}

export function repositoryFailure(error, meta = {}) {
  const normalized = error instanceof GateRepositoryError
    ? error
    : new GateRepositoryError(
        RepositoryErrorCode.PERSISTENCE,
        error?.message || 'Repository operation failed.',
        { cause: error }
      );

  return Object.freeze({
    ok: false,
    data: null,
    error: normalized,
    meta: Object.freeze({ ...meta })
  });
}

export function validationFailure(message, details = null) {
  return repositoryFailure(new GateRepositoryError(
    RepositoryErrorCode.VALIDATION,
    message,
    { details }
  ));
}

export function repositoryErrorFromResponse(response = {}) {
  const status = Number(response.status || 0);
  const body = response.body || {};
  const message = body.error || body.message || `Persistence request failed with status ${status || 'unknown'}.`;

  if (status === 401) return new GateRepositoryError(RepositoryErrorCode.UNAUTHORIZED, message, { status });
  if (status === 403) return new GateRepositoryError(RepositoryErrorCode.FORBIDDEN, message, { status });
  if (status === 404) return new GateRepositoryError(RepositoryErrorCode.NOT_FOUND, message, { status });
  if (status === 409 || status === 412) return new GateRepositoryError(RepositoryErrorCode.CONFLICT, message, { status, details: body });
  if (status >= 500) return new GateRepositoryError(RepositoryErrorCode.PERSISTENCE, message, { status, retryable: true, details: body });
  return new GateRepositoryError(RepositoryErrorCode.TRANSPORT, message, { status: status || null, details: body });
}
