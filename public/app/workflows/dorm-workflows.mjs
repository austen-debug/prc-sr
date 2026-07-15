import { normalizeText } from '../domain/normalization.mjs';
import {
  WorkflowPhase,
  completeWorkflow,
  createOperationId,
  partialWorkflow
} from './workflow-result.mjs';
import {
  appendRequiredAudit,
  requireRepositories,
  repositoryStepFailure,
  timestampFrom,
  verifyRecord
} from './workflow-helpers.mjs';

function operationIdFor(command, prefix) {
  return normalizeText(command.operationId) || createOperationId(prefix);
}

async function executeDormMutation({
  repositories,
  command,
  clock,
  workflow,
  eventType,
  summary,
  mutate,
  verify
}) {
  requireRepositories(repositories, ['dorms', 'audit']);
  const operationId = operationIdFor(command, workflow);
  const before = await repositories.dorms.getById(command.dormId);
  if (!before.ok) {
    return repositoryStepFailure({
      result: before,
      workflow,
      operationId,
      phase: WorkflowPhase.LOAD,
      message: 'The dorm could not be loaded for the requested transition.',
      completedSteps: [],
      pendingSteps: ['persist', 'verify', 'audit']
    });
  }

  const occurredAt = command.occurredAt || command.updatedAt || command.openedAt || command.closedAt || timestampFrom(clock);
  const writeResult = await mutate(before.data, occurredAt);
  if (!writeResult.ok) {
    return repositoryStepFailure({
      result: writeResult,
      workflow,
      operationId,
      phase: WorkflowPhase.PERSIST,
      message: `${summary} was not persisted.`,
      completedSteps: ['load'],
      pendingSteps: ['persist', 'verify', 'audit']
    });
  }
  if (writeResult.meta?.unchanged) {
    return completeWorkflow({
      workflow,
      operationId,
      message: `${summary} required no change.`,
      data: { record: writeResult.data },
      completedSteps: ['load'],
      unchanged: true
    });
  }

  const authoritative = await verifyRecord(repositories.dorms, writeResult.data.id, verify);
  if (!authoritative.ok) {
    return partialWorkflow({
      workflow,
      operationId,
      phase: WorkflowPhase.VERIFY,
      message: `${summary} may be persisted, but authoritative verification did not complete.`,
      error: authoritative.error,
      data: { recordId: writeResult.data.id },
      completedSteps: ['load', 'persist'],
      pendingSteps: ['verify', 'audit'],
      recovery: { action: 'refetch_and_verify', entityType: 'dorm', entityId: writeResult.data.id }
    });
  }

  const record = authoritative.data;
  const audited = await appendRequiredAudit({
    repositories,
    workflow,
    operationId,
    completedSteps: ['load', 'persist', 'verify'],
    command: {
      eventType,
      entityType: 'dorm',
      entityId: record.id,
      weekGroup: record.weekGroup,
      actorRole: command.actorRole,
      occurredAt,
      priorVersion: before.data.recordVersion,
      resultingVersion: record.recordVersion,
      summary,
      metadata: {
        dormName: record.payload.name,
        state: record.payload.state,
        phase: record.payload.phase,
        load: record.payload.load,
        closedTimer: record.payload.closedTimer
      }
    }
  });
  if (!audited.ok) return audited.workflowResult;

  return completeWorkflow({
    workflow,
    operationId,
    message: `${summary} completed and was verified.`,
    data: { record, audit: audited.result.data },
    completedSteps: ['load', 'persist', 'verify', 'audit']
  });
}

export function updateDormLoadWorkflow({ repositories, command = {}, clock } = {}) {
  const expectedLoad = Number(command.load ?? 0);
  return executeDormMutation({
    repositories,
    command,
    clock,
    workflow: 'update_dorm_load',
    eventType: 'dorm_load_updated',
    summary: `Dorm load updated to ${expectedLoad}`,
    mutate: (_, occurredAt) => repositories.dorms.updateLoad(command.dormId, {
      ...command,
      updatedAt: occurredAt
    }),
    verify: record => record.payload.load === expectedLoad
  });
}

export function openDormWorkflow({ repositories, command = {}, clock } = {}) {
  return executeDormMutation({
    repositories,
    command,
    clock,
    workflow: 'open_dorm',
    eventType: 'dorm_opened',
    summary: 'Dorm opened',
    mutate: (_, occurredAt) => repositories.dorms.open(command.dormId, {
      ...command,
      openedAt: occurredAt
    }),
    verify: record => record.payload.state === 'open' && Boolean(record.payload.openedAt)
  });
}

export function closeDormWorkflow({ repositories, command = {}, clock } = {}) {
  const expectedTimer = normalizeText(command.closedTimer);
  return executeDormMutation({
    repositories,
    command,
    clock,
    workflow: 'close_dorm',
    eventType: 'dorm_closed',
    summary: 'Dorm closed',
    mutate: (_, occurredAt) => repositories.dorms.close(command.dormId, {
      ...command,
      closedAt: occurredAt
    }),
    verify: record => (
      record.payload.state === 'closed'
      && Boolean(record.payload.closedAt)
      && (!expectedTimer || record.payload.closedTimer === expectedTimer)
    )
  });
}

export function reopenDormWorkflow({ repositories, command = {}, clock } = {}) {
  return executeDormMutation({
    repositories,
    command,
    clock,
    workflow: 'reopen_dorm',
    eventType: 'dorm_reopened',
    summary: 'Dorm reopened',
    mutate: (_, occurredAt) => repositories.dorms.reopen(command.dormId, {
      ...command,
      openedAt: occurredAt
    }),
    verify: record => (
      record.payload.state === 'open'
      && Boolean(record.payload.openedAt)
      && !record.payload.closedAt
      && !record.payload.closedTimer
    )
  });
}

export function correctDormFinalTimeWorkflow({ repositories, command = {}, clock } = {}) {
  const expectedTimer = normalizeText(command.closedTimer);
  return executeDormMutation({
    repositories,
    command,
    clock,
    workflow: 'correct_dorm_final_time',
    eventType: 'dorm_final_time_corrected',
    summary: `Dorm final time corrected to ${expectedTimer}`,
    mutate: (_, occurredAt) => repositories.dorms.correctFinalTime(command.dormId, {
      ...command,
      updatedAt: occurredAt
    }),
    verify: record => record.payload.state === 'closed' && record.payload.closedTimer === expectedTimer
  });
}
