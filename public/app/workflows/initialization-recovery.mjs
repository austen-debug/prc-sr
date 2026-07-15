import { normalizeText, normalizeWeekGroup } from '../domain/normalization.mjs';
import {
  WorkflowPhase,
  blockedWorkflow,
  completeWorkflow,
  createOperationId
} from './workflow-result.mjs';
import {
  appendRequiredAudit,
  requireRepositories,
  repositoryStepFailure,
  timestampFrom
} from './workflow-helpers.mjs';

export async function compensatePartialInitializationWorkflow({ repositories, command = {}, clock } = {}) {
  requireRepositories(repositories, ['dorms', 'config', 'audit']);
  const workflow = 'compensate_partial_initialization';
  const operationId = normalizeText(command.operationId) || createOperationId(workflow);
  const initializationOperationId = normalizeText(command.initializationOperationId);
  const weekGroup = normalizeWeekGroup(command.weekGroup);
  const occurredAt = command.occurredAt || timestampFrom(clock);

  if (!initializationOperationId || !weekGroup) return blockedWorkflow({
    workflow,
    operationId,
    phase: WorkflowPhase.VALIDATE,
    message: 'Initialization operation id and Week Group are required.',
    error: { code: 'validation_error', message: 'Compensation identity is incomplete.' },
    pendingSteps: ['load_partial_initialization']
  });

  const active = await repositories.config.getActiveWeekGroup();
  if (!active.ok) return repositoryStepFailure({
    result: active,
    workflow,
    operationId,
    phase: WorkflowPhase.LOAD,
    message: 'Active Week Group context could not be checked.',
    completedSteps: [],
    pendingSteps: ['load_partial_initialization', 'remove_partial_dorms', 'audit_compensation']
  });
  if (active.data === weekGroup) return blockedWorkflow({
    workflow,
    operationId,
    phase: WorkflowPhase.VALIDATE,
    message: `${weekGroup} is active and must use normal closeout rather than initialization compensation.`,
    error: { code: 'active_initialization', message: 'Active Week Groups cannot be compensated.' },
    pendingSteps: ['closeout_week_group']
  });

  const dorms = await repositories.dorms.list({ weekGroup });
  if (!dorms.ok) return repositoryStepFailure({
    result: dorms,
    workflow,
    operationId,
    phase: WorkflowPhase.LOAD,
    message: 'Partial dorm records could not be loaded.',
    completedSteps: [],
    pendingSteps: ['remove_partial_dorms', 'audit_compensation']
  });
  const candidates = dorms.data.filter(record => normalizeText(record.raw?.operation_id) === initializationOperationId);
  const unrelated = dorms.data.filter(record => normalizeText(record.raw?.operation_id) !== initializationOperationId);
  if (unrelated.length) return blockedWorkflow({
    workflow,
    operationId,
    phase: WorkflowPhase.VALIDATE,
    message: 'Unrelated live dorm records exist; automated compensation is blocked.',
    error: { code: 'unrelated_live_records', message: 'Manual review is required.', details: { recordIds: unrelated.map(record => record.id) } },
    pendingSteps: ['review_existing_records']
  });

  const removedIds = [];
  for (const record of candidates) {
    const removed = await repositories.dorms.deleteById(record.id, {
      actorRole: command.actorRole,
      timestamp: occurredAt
    });
    if (!removed.ok) return repositoryStepFailure({
      result: removed,
      workflow,
      operationId,
      phase: WorkflowPhase.CLEAR,
      message: `Compensation stopped while removing dorm ${record.payload.name}.`,
      completedSteps: removedIds.map(id => `removed:${id}`),
      pendingSteps: [`remove:${record.id}`, 'audit_compensation'],
      partial: removedIds.length > 0,
      recovery: { action: 'resume_initialization_compensation', operationId, initializationOperationId, weekGroup, removedIds }
    });
    removedIds.push(record.id);

    const audit = await appendRequiredAudit({
      repositories,
      workflow,
      operationId,
      completedSteps: removedIds.map(id => `removed:${id}`),
      command: {
        eventType: 'initialization_dorm_compensated',
        entityType: 'dorm',
        entityId: record.id,
        weekGroup,
        actorRole: command.actorRole,
        occurredAt,
        priorVersion: record.recordVersion,
        resultingVersion: record.recordVersion + 1,
        summary: `Partial initialization dorm ${record.payload.name} compensated`,
        metadata: { initializationOperationId, removed: true }
      }
    });
    if (!audit.ok) return audit.workflowResult;
  }

  const finalAudit = await appendRequiredAudit({
    repositories,
    workflow,
    operationId,
    completedSteps: ['remove_partial_dorms'],
    command: {
      eventType: 'week_group_initialization_compensated',
      entityType: 'week_group',
      entityId: weekGroup,
      weekGroup,
      actorRole: command.actorRole,
      occurredAt,
      priorVersion: 0,
      resultingVersion: 0,
      summary: `Partial initialization for ${weekGroup} compensated`,
      metadata: { initializationOperationId, removedDormIds: removedIds }
    }
  });
  if (!finalAudit.ok) return finalAudit.workflowResult;

  return completeWorkflow({
    workflow,
    operationId,
    message: `Partial initialization for ${weekGroup} was compensated.`,
    data: { weekGroup, removedDormIds: Object.freeze(removedIds), audit: finalAudit.result.data },
    completedSteps: ['remove_partial_dorms', 'audit_compensation']
  });
}
