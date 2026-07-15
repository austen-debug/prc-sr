import { normalizeText } from '../domain/normalization.mjs';
import { RepositoryErrorCode } from '../data/repository-result.mjs';

export const WorkflowStatus = Object.freeze({
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  FAILED: 'failed',
  CONFLICT: 'conflict',
  BLOCKED: 'blocked'
});

export const WorkflowPhase = Object.freeze({
  VALIDATE: 'validate',
  LOAD: 'load',
  PERSIST: 'persist',
  VERIFY: 'verify',
  AUDIT: 'audit',
  CLEAR: 'clear',
  COMPLETE: 'complete'
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function createOperationId(prefix = 'gate') {
  const normalizedPrefix = normalizeText(prefix).toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'gate';
  const id = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${normalizedPrefix}:${id}`;
}

export function workflowResult({
  ok = false,
  workflow = '',
  operationId = '',
  status = WorkflowStatus.FAILED,
  phase = WorkflowPhase.VALIDATE,
  message = '',
  data = null,
  error = null,
  completedSteps = [],
  pendingSteps = [],
  recovery = null,
  unchanged = false
} = {}) {
  return deepFreeze({
    ok: Boolean(ok),
    workflow: normalizeText(workflow),
    operationId: normalizeText(operationId),
    status,
    phase,
    message: normalizeText(message),
    data,
    error: error ? {
      code: normalizeText(error.code || 'workflow_error'),
      message: normalizeText(error.message || message || 'Workflow failed.'),
      status: Number.isFinite(error.status) ? error.status : null,
      details: error.details ?? null
    } : null,
    completedSteps: [...completedSteps],
    pendingSteps: [...pendingSteps],
    recovery,
    unchanged: Boolean(unchanged)
  });
}

export function completeWorkflow(options = {}) {
  return workflowResult({
    ...options,
    ok: true,
    status: WorkflowStatus.COMPLETE,
    phase: WorkflowPhase.COMPLETE,
    pendingSteps: []
  });
}

export function partialWorkflow(options = {}) {
  return workflowResult({
    ...options,
    ok: false,
    status: WorkflowStatus.PARTIAL
  });
}

export function blockedWorkflow(options = {}) {
  return workflowResult({
    ...options,
    ok: false,
    status: WorkflowStatus.BLOCKED
  });
}

export function failedWorkflow(options = {}) {
  return workflowResult({
    ...options,
    ok: false,
    status: WorkflowStatus.FAILED
  });
}

export function repositoryFailureWorkflow({
  result,
  workflow,
  operationId,
  phase,
  message = '',
  completedSteps = [],
  pendingSteps = [],
  recovery = null,
  partial = false
} = {}) {
  const repositoryError = result?.error || {};
  const conflict = repositoryError.code === RepositoryErrorCode.CONFLICT;
  return workflowResult({
    ok: false,
    workflow,
    operationId,
    status: conflict ? WorkflowStatus.CONFLICT : (partial ? WorkflowStatus.PARTIAL : WorkflowStatus.FAILED),
    phase,
    message: message || repositoryError.message || 'Repository operation failed.',
    error: repositoryError,
    completedSteps,
    pendingSteps,
    recovery
  });
}
