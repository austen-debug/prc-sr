import {
  normalizeText,
  normalizeTimestamp,
  normalizeWeekGroup,
  toNonNegativeNumber
} from '../domain/normalization.mjs';
import {
  WorkflowPhase,
  blockedWorkflow,
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

const WINDOW_PAIRS = Object.freeze([
  ['receiving_day_one_start', 'receiving_day_one_end', 'Receiving Day One'],
  ['receiving_day_two_start', 'receiving_day_two_end', 'Receiving Day Two']
]);

function identityPart(value) {
  return normalizeText(value).replace(/\s+/g, ' ').toUpperCase();
}

function dormIdentity(dorm = {}) {
  return `${identityPart(dorm.sdq)}::${identityPart(dorm.name || dorm.dormName)}`;
}

function validateWindows(windows = {}) {
  const errors = [];
  const normalized = {};
  for (const [startKey, endKey, label] of WINDOW_PAIRS) {
    const startRaw = normalizeText(windows[startKey]);
    const endRaw = normalizeText(windows[endKey]);
    if (Boolean(startRaw) !== Boolean(endRaw)) {
      errors.push(`${label} requires both start and end.`);
      continue;
    }
    if (!startRaw) {
      normalized[startKey] = '';
      normalized[endKey] = '';
      continue;
    }
    const start = normalizeTimestamp(startRaw);
    const end = normalizeTimestamp(endRaw);
    if (!start || !end) errors.push(`${label} contains an invalid date/time.`);
    else if (Date.parse(end) <= Date.parse(start)) errors.push(`${label} end must be after start.`);
    normalized[startKey] = start;
    normalized[endKey] = end;
  }
  if (
    normalized.receiving_day_one_end
    && normalized.receiving_day_two_start
    && Date.parse(normalized.receiving_day_two_start) < Date.parse(normalized.receiving_day_one_end)
  ) errors.push('Receiving Day Two cannot start before Receiving Day One ends.');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), windows: Object.freeze(normalized) });
}

function validateDorms(dorms = []) {
  const errors = [];
  const seen = new Set();
  const normalized = [];
  if (!Array.isArray(dorms) || dorms.length === 0) errors.push('At least one dorm is required.');
  for (const [index, dorm] of (Array.isArray(dorms) ? dorms : []).entries()) {
    const name = normalizeText(dorm.name || dorm.dormName) || `Dorm ${index + 1}`;
    const capacity = toNonNegativeNumber(dorm.capacity ?? dorm.load);
    const identity = dormIdentity({ ...dorm, name });
    if (capacity < 1 || capacity > 60) errors.push(`${name} capacity must be between 1 and 60.`);
    if (dorm.band && dorm.spaceForce) errors.push(`${name} cannot be both Band and Space Force.`);
    if (seen.has(identity)) errors.push(`Duplicate Squadron/Dorm identity: ${identity}.`);
    seen.add(identity);
    normalized.push(Object.freeze({
      name,
      sdq: normalizeText(dorm.sdq),
      section: normalizeText(dorm.section),
      interSection: normalizeText(dorm.interSection),
      sex: normalizeText(dorm.sex || 'male').toLowerCase(),
      band: Boolean(dorm.band),
      spaceForce: Boolean(dorm.spaceForce),
      capacity,
      displayOrder: Number.isFinite(Number(dorm.displayOrder)) ? Number(dorm.displayOrder) : index + 1,
      sourceRowIndex: Number.isFinite(Number(dorm.sourceRowIndex)) ? Number(dorm.sourceRowIndex) : index,
      identity
    }));
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), dorms: Object.freeze(normalized) });
}

export async function initializeWeekGroupWorkflow({ repositories, command = {}, clock } = {}) {
  requireRepositories(repositories, ['dorms', 'config', 'audit']);
  const workflow = 'initialize_week_group';
  const operationId = normalizeText(command.operationId) || createOperationId(workflow);
  const weekGroup = normalizeWeekGroup(command.weekGroup);
  const occurredAt = command.occurredAt || timestampFrom(clock);
  const dormValidation = validateDorms(command.dorms);
  const windowValidation = validateWindows(command.receivingWindows || {});

  if (!weekGroup || !dormValidation.valid || !windowValidation.valid) {
    return blockedWorkflow({
      workflow,
      operationId,
      phase: WorkflowPhase.VALIDATE,
      message: 'Week Group initialization failed preflight validation.',
      error: {
        code: 'validation_error',
        message: 'Week Group initialization input is invalid.',
        details: {
          weekGroupRequired: !weekGroup,
          dormErrors: dormValidation.errors,
          windowErrors: windowValidation.errors
        }
      },
      pendingSteps: ['persist_dorms', 'verify_dorms', 'audit_dorms', 'set_active_week_group', 'verify_active_week_group', 'audit_initialization']
    });
  }

  const existingCompletion = await repositories.audit.findByOperation({
    operationId,
    eventType: 'week_group_initialized',
    entityId: weekGroup
  });
  if (existingCompletion.ok && existingCompletion.data) {
    const active = await repositories.config.getActiveWeekGroup();
    const existingDorms = await repositories.dorms.list({ weekGroup });
    if (active.ok && active.data === weekGroup && existingDorms.ok) {
      return completeWorkflow({
        workflow,
        operationId,
        message: `${weekGroup} was already initialized by this operation.`,
        data: { weekGroup, dorms: existingDorms.data, audit: existingCompletion.data },
        completedSteps: ['persist_dorms', 'verify_dorms', 'audit_dorms', 'set_active_week_group', 'verify_active_week_group', 'audit_initialization'],
        unchanged: true
      });
    }
  }

  const active = await repositories.config.getActiveWeekGroup();
  if (!active.ok) {
    return repositoryStepFailure({
      result: active,
      workflow,
      operationId,
      phase: WorkflowPhase.LOAD,
      message: 'The active Week Group context could not be loaded.',
      completedSteps: [],
      pendingSteps: ['persist_dorms', 'verify_dorms', 'audit_dorms', 'set_active_week_group', 'verify_active_week_group', 'audit_initialization']
    });
  }
  if (active.data && active.data !== weekGroup) {
    return blockedWorkflow({
      workflow,
      operationId,
      phase: WorkflowPhase.VALIDATE,
      message: `Active Week Group ${active.data} must be closed out before ${weekGroup} can be initialized.`,
      error: { code: 'active_week_group_conflict', message: 'Another Week Group is active.', details: { activeWeekGroup: active.data } },
      pendingSteps: ['closeout_active_week_group']
    });
  }

  const existingDorms = await repositories.dorms.list({ weekGroup });
  if (!existingDorms.ok) {
    return repositoryStepFailure({
      result: existingDorms,
      workflow,
      operationId,
      phase: WorkflowPhase.LOAD,
      message: 'Existing dorm records could not be checked.',
      completedSteps: [],
      pendingSteps: ['persist_dorms', 'verify_dorms', 'audit_dorms', 'set_active_week_group', 'verify_active_week_group', 'audit_initialization']
    });
  }

  const operationDorms = existingDorms.data.filter(record => normalizeText(record.raw?.operation_id) === operationId);
  const unrelatedDorms = existingDorms.data.filter(record => normalizeText(record.raw?.operation_id) !== operationId);
  if (unrelatedDorms.length) {
    return blockedWorkflow({
      workflow,
      operationId,
      phase: WorkflowPhase.VALIDATE,
      message: `${weekGroup} already contains live dorm records from another operation.`,
      error: {
        code: 'existing_live_records',
        message: 'Existing live dorm records block initialization.',
        details: { recordIds: unrelatedDorms.map(record => record.id) }
      },
      pendingSteps: ['review_existing_records']
    });
  }

  const createdByIdentity = new Map(operationDorms.map(record => [
    normalizeText(record.raw?.dorm_identity) || dormIdentity({ sdq: record.payload.sdq, name: record.payload.name }),
    record
  ]));
  const createdDorms = [...operationDorms];

  for (const [index, dorm] of dormValidation.dorms.entries()) {
    let record = createdByIdentity.get(dorm.identity) || null;
    if (!record) {
      const created = await repositories.dorms.createDorm({
        ...dorm,
        actorRole: command.actorRole,
        createdAt: occurredAt,
        weekGroup,
        operationId,
        dormIdentity: dorm.identity,
        receivingWindows: windowValidation.windows
      });
      if (!created.ok) {
        return repositoryStepFailure({
          result: created,
          workflow,
          operationId,
          phase: WorkflowPhase.PERSIST,
          message: `Initialization stopped while creating ${dorm.name}.`,
          completedSteps: createdDorms.map(item => `created:${item.id}`),
          pendingSteps: [`create_dorm:${index}`, 'verify_dorms', 'audit_dorms', 'set_active_week_group', 'verify_active_week_group', 'audit_initialization'],
          partial: createdDorms.length > 0,
          recovery: {
            action: 'resume_or_remove_created_dorms',
            weekGroup,
            operationId,
            createdDormIds: createdDorms.map(item => item.id),
            nextDormIndex: index
          }
        });
      }
      record = created.data;
      createdDorms.push(record);
    }

    const verified = await verifyRecord(repositories.dorms, record.id, item => (
      item.weekGroup === weekGroup
      && item.payload.name === dorm.name
      && item.payload.capacity === dorm.capacity
      && item.payload.state === 'empty'
    ));
    if (!verified.ok) {
      return partialWorkflow({
        workflow,
        operationId,
        phase: WorkflowPhase.VERIFY,
        message: `Dorm ${dorm.name} was created but could not be authoritatively verified.`,
        error: verified.error,
        data: { createdDormIds: createdDorms.map(item => item.id) },
        completedSteps: createdDorms.map(item => `created:${item.id}`),
        pendingSteps: [`verify_dorm:${record.id}`, 'audit_dorms', 'set_active_week_group', 'verify_active_week_group', 'audit_initialization'],
        recovery: { action: 'refetch_and_resume_initialization', weekGroup, operationId, recordId: record.id }
      });
    }
    record = verified.data;
    createdByIdentity.set(dorm.identity, record);

    const audited = await appendRequiredAudit({
      repositories,
      workflow,
      operationId,
      completedSteps: [...createdDorms.map(item => `created:${item.id}`), `verified:${record.id}`],
      pendingSteps: ['set_active_week_group', 'verify_active_week_group', 'audit_initialization'],
      command: {
        eventType: 'dorm_created',
        entityType: 'dorm',
        entityId: record.id,
        weekGroup,
        actorRole: command.actorRole,
        occurredAt,
        priorVersion: 0,
        resultingVersion: record.recordVersion,
        summary: `Dorm ${record.payload.name} created for ${weekGroup}`,
        metadata: { dormName: record.payload.name, capacity: record.payload.capacity, dormIdentity: dorm.identity }
      }
    });
    if (!audited.ok) return audited.workflowResult;
  }

  const priorConfigVersion = active.meta?.record?.recordVersion || 0;
  let activeRecord = active.meta?.record || null;
  if (active.data !== weekGroup) {
    const setActive = await repositories.config.setActiveWeekGroup(weekGroup, {
      actorRole: command.actorRole,
      updatedAt: occurredAt
    });
    if (!setActive.ok) {
      return repositoryStepFailure({
        result: setActive,
        workflow,
        operationId,
        phase: WorkflowPhase.PERSIST,
        message: 'All dorms are verified, but the active Week Group could not be set.',
        completedSteps: ['persist_dorms', 'verify_dorms', 'audit_dorms'],
        pendingSteps: ['set_active_week_group', 'verify_active_week_group', 'audit_initialization'],
        partial: true,
        recovery: { action: 'set_active_week_group_and_finish', weekGroup, operationId, createdDormIds: createdDorms.map(item => item.id) }
      });
    }
    activeRecord = setActive.data;
  }

  const verifiedActive = await repositories.config.getActiveWeekGroup();
  if (!verifiedActive.ok || verifiedActive.data !== weekGroup) {
    return partialWorkflow({
      workflow,
      operationId,
      phase: WorkflowPhase.VERIFY,
      message: 'The active Week Group write may have completed, but verification failed.',
      error: verifiedActive.error || { code: 'verification_failed', message: 'Active Week Group does not match.' },
      data: { weekGroup, createdDormIds: createdDorms.map(item => item.id) },
      completedSteps: ['persist_dorms', 'verify_dorms', 'audit_dorms', 'set_active_week_group'],
      pendingSteps: ['verify_active_week_group', 'audit_initialization'],
      recovery: { action: 'refetch_and_verify_active_week_group', weekGroup, operationId }
    });
  }
  activeRecord = verifiedActive.meta?.record || activeRecord;

  const finalAudit = await appendRequiredAudit({
    repositories,
    workflow,
    operationId,
    completedSteps: ['persist_dorms', 'verify_dorms', 'audit_dorms', 'set_active_week_group', 'verify_active_week_group'],
    command: {
      eventType: 'week_group_initialized',
      entityType: 'week_group',
      entityId: weekGroup,
      weekGroup,
      actorRole: command.actorRole,
      occurredAt,
      priorVersion: priorConfigVersion,
      resultingVersion: activeRecord?.recordVersion || priorConfigVersion,
      summary: `${weekGroup} initialized with ${createdDorms.length} dorms`,
      metadata: { dormCount: createdDorms.length, dormIds: createdDorms.map(item => item.id) }
    }
  });
  if (!finalAudit.ok) return finalAudit.workflowResult;

  return completeWorkflow({
    workflow,
    operationId,
    message: `${weekGroup} initialized with ${createdDorms.length} verified dorms.`,
    data: { weekGroup, dorms: Object.freeze(createdDorms), activeRecord, audit: finalAudit.result.data },
    completedSteps: ['persist_dorms', 'verify_dorms', 'audit_dorms', 'set_active_week_group', 'verify_active_week_group', 'audit_initialization']
  });
}
