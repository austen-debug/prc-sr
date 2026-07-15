import { normalizeText } from '../domain/normalization.mjs';
import {
  WorkflowPhase,
  partialWorkflow,
  repositoryFailureWorkflow
} from './workflow-result.mjs';

export function requireRepositories(repositories, names = []) {
  const missing = names.filter(name => !repositories?.[name]);
  if (missing.length) throw new TypeError(`Workflow repositories are missing: ${missing.join(', ')}.`);
}

export function timestampFrom(clock) {
  const value = typeof clock === 'function' ? clock() : clock;
  if (value instanceof Date) return value.toISOString();
  const text = normalizeText(value);
  if (text && Number.isFinite(Date.parse(text))) return new Date(text).toISOString();
  return new Date().toISOString();
}

export async function verifyRecord(repository, id, predicate = () => true) {
  const result = await repository.getById(id);
  if (!result.ok) return result;
  if (!predicate(result.data)) {
    return {
      ok: false,
      data: null,
      error: {
        code: 'verification_failed',
        message: `Record ${id} did not match the required authoritative state.`,
        status: null,
        details: { id }
      }
    };
  }
  return result;
}

export async function appendRequiredAudit({
  repositories,
  workflow,
  operationId,
  command,
  completedSteps = [],
  pendingSteps = []
} = {}) {
  const result = await repositories.audit.appendOnce({
    ...command,
    metadata: {
      ...(command.metadata || {}),
      operationId
    }
  });
  if (result.ok) return { ok: true, result };
  return {
    ok: false,
    workflowResult: partialWorkflow({
      workflow,
      operationId,
      phase: WorkflowPhase.AUDIT,
      message: 'The operational write is verified, but its required audit event is still pending.',
      error: result.error,
      completedSteps,
      pendingSteps: ['append_required_audit', ...pendingSteps],
      recovery: {
        action: 'retry_audit',
        auditCommand: {
          ...command,
          metadata: {
            ...(command.metadata || {}),
            operationId
          }
        }
      }
    })
  };
}

export function repositoryStepFailure({
  result,
  workflow,
  operationId,
  phase,
  message,
  completedSteps,
  pendingSteps,
  recovery,
  partial = false
}) {
  return repositoryFailureWorkflow({
    result,
    workflow,
    operationId,
    phase,
    message,
    completedSteps,
    pendingSteps,
    recovery,
    partial
  });
}
