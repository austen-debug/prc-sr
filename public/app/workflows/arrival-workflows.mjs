import { normalizeText, normalizeWeekGroup } from '../domain/normalization.mjs';
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

function workflowIdentity(command, prefix) {
  return normalizeText(command.operationId) || createOperationId(prefix);
}

async function finalizeBusWrite({
  repositories,
  workflow,
  operationId,
  actorRole,
  weekGroup,
  occurredAt,
  priorVersion,
  writeResult,
  eventType,
  summary,
  predicate,
  completedSteps = ['persist']
}) {
  if (!writeResult.ok) {
    return repositoryStepFailure({
      result: writeResult,
      workflow,
      operationId,
      phase: WorkflowPhase.PERSIST,
      message: `${summary} was not persisted.`,
      completedSteps: [],
      pendingSteps: ['persist', 'verify', 'audit']
    });
  }

  const record = writeResult.data;
  const verified = await verifyRecord(repositories.buses, record.id, predicate);
  if (!verified.ok) {
    return partialWorkflow({
      workflow,
      operationId,
      phase: WorkflowPhase.VERIFY,
      message: `${summary} may be persisted, but authoritative verification did not complete.`,
      error: verified.error,
      data: { recordId: record.id },
      completedSteps,
      pendingSteps: ['verify', 'audit'],
      recovery: { action: 'refetch_and_verify', entityType: 'bus', entityId: record.id }
    });
  }

  const authoritative = verified.data;
  const audited = await appendRequiredAudit({
    repositories,
    workflow,
    operationId,
    completedSteps: [...completedSteps, 'verify'],
    command: {
      eventType,
      entityType: 'bus',
      entityId: authoritative.id,
      weekGroup: weekGroup || authoritative.weekGroup,
      actorRole,
      occurredAt,
      priorVersion,
      resultingVersion: authoritative.recordVersion,
      summary,
      metadata: {
        busId: authoritative.payload.busId,
        busType: authoritative.payload.busType,
        status: authoritative.payload.status
      }
    }
  });
  if (!audited.ok) return audited.workflowResult;

  return completeWorkflow({
    workflow,
    operationId,
    message: `${summary} completed and was verified.`,
    data: { record: authoritative, audit: audited.result.data },
    completedSteps: [...completedSteps, 'verify', 'audit']
  });
}

export async function dispatchAirportBusWorkflow({ repositories, command = {}, clock } = {}) {
  requireRepositories(repositories, ['buses', 'audit']);
  const workflow = 'dispatch_airport_bus';
  const operationId = workflowIdentity(command, workflow);
  const occurredAt = command.departedAt || timestampFrom(clock);
  const weekGroup = normalizeWeekGroup(command.weekGroup);
  const writeResult = await repositories.buses.createAirportBus({
    ...command,
    weekGroup,
    departedAt: occurredAt
  });
  return finalizeBusWrite({
    repositories,
    workflow,
    operationId,
    actorRole: command.actorRole,
    weekGroup,
    occurredAt,
    priorVersion: 0,
    writeResult,
    eventType: 'airport_bus_dispatched',
    summary: `Airport bus ${normalizeText(command.busId) || 'record'} dispatched`,
    predicate: record => record.payload.active && record.payload.busType === 'airport'
  });
}

export async function createLocalArrivalWorkflow({ repositories, command = {}, clock } = {}) {
  requireRepositories(repositories, ['buses', 'audit']);
  const workflow = 'create_local_arrival';
  const operationId = workflowIdentity(command, workflow);
  const occurredAt = command.arrivedAt || timestampFrom(clock);
  const weekGroup = normalizeWeekGroup(command.weekGroup);
  const writeResult = await repositories.buses.createLocalArrival({
    ...command,
    weekGroup,
    arrivedAt: occurredAt
  });
  return finalizeBusWrite({
    repositories,
    workflow,
    operationId,
    actorRole: command.actorRole,
    weekGroup,
    occurredAt,
    priorVersion: 0,
    writeResult,
    eventType: 'local_arrival_created',
    summary: `Local arrival from ${normalizeText(command.destination) || 'origin'} created`,
    predicate: record => record.payload.confirmedArrival && record.payload.busType === 'local'
  });
}

export async function confirmArrivalWorkflow({ repositories, command = {}, clock } = {}) {
  requireRepositories(repositories, ['buses', 'audit']);
  const workflow = 'confirm_bus_arrival';
  const operationId = workflowIdentity(command, workflow);
  const before = await repositories.buses.getById(command.busId);
  if (!before.ok) {
    return repositoryStepFailure({
      result: before,
      workflow,
      operationId,
      phase: WorkflowPhase.LOAD,
      message: 'The bus could not be loaded for arrival confirmation.',
      completedSteps: [],
      pendingSteps: ['persist', 'verify', 'audit']
    });
  }
  if (before.data.payload.confirmedArrival) {
    return completeWorkflow({
      workflow,
      operationId,
      message: 'The bus was already confirmed arrived; no new write was performed.',
      data: { record: before.data },
      completedSteps: ['load'],
      unchanged: true
    });
  }

  const occurredAt = command.arrivedAt || timestampFrom(clock);
  const writeResult = await repositories.buses.confirmArrival(command.busId, {
    ...command,
    arrivedAt: occurredAt
  });
  return finalizeBusWrite({
    repositories,
    workflow,
    operationId,
    actorRole: command.actorRole,
    weekGroup: before.data.weekGroup,
    occurredAt,
    priorVersion: before.data.recordVersion,
    writeResult,
    eventType: 'bus_arrival_confirmed',
    summary: `Bus ${before.data.payload.busId || before.data.id} arrival confirmed`,
    predicate: record => record.payload.confirmedArrival && record.payload.arrivedAt === new Date(occurredAt).toISOString(),
    completedSteps: ['load', 'persist']
  });
}

export async function correctArrivalCountsWorkflow({ repositories, command = {}, clock } = {}) {
  requireRepositories(repositories, ['buses', 'audit']);
  const workflow = 'correct_arrival_counts';
  const operationId = workflowIdentity(command, workflow);
  const before = await repositories.buses.getById(command.busId);
  if (!before.ok) {
    return repositoryStepFailure({
      result: before,
      workflow,
      operationId,
      phase: WorkflowPhase.LOAD,
      message: 'The bus could not be loaded for count correction.',
      completedSteps: [],
      pendingSteps: ['persist', 'verify', 'audit']
    });
  }

  const occurredAt = command.updatedAt || timestampFrom(clock);
  const expected = {
    total: Number(command.total ?? command.otwCount ?? 0),
    female: Number(command.female ?? 0),
    naturalization: Number(command.naturalization ?? 0),
    spaceForce: Number(command.spaceForce ?? 0)
  };
  const writeResult = await repositories.buses.updateCounts(command.busId, {
    ...command,
    updatedAt: occurredAt
  });
  return finalizeBusWrite({
    repositories,
    workflow,
    operationId,
    actorRole: command.actorRole,
    weekGroup: before.data.weekGroup,
    occurredAt,
    priorVersion: before.data.recordVersion,
    writeResult,
    eventType: 'bus_counts_corrected',
    summary: `Bus ${before.data.payload.busId || before.data.id} counts corrected`,
    predicate: record => (
      record.payload.total === expected.total
      && record.payload.female === expected.female
      && record.payload.naturalization === expected.naturalization
      && record.payload.spaceForce === expected.spaceForce
    ),
    completedSteps: ['load', 'persist']
  });
}
