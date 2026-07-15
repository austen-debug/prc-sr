import { buildArchiveSnapshot, validateArchiveSnapshot } from '../domain/archives.mjs';
import { normalizeText, normalizeWeekGroup } from '../domain/normalization.mjs';
import { RepositoryErrorCode } from '../data/repository-result.mjs';
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

function manifestFor({ buses = [], dorms = [], soundEvents = [], configs = [] } = {}) {
  const all = [...buses, ...dorms, ...soundEvents, ...configs].filter(Boolean);
  return Object.freeze({
    busIds: buses.map(record => record.id),
    dormIds: dorms.map(record => record.id),
    soundEventIds: soundEvents.map(record => record.id),
    configIds: configs.filter(Boolean).map(record => record.id),
    recordVersions: Object.freeze(Object.fromEntries(all.map(record => [record.id, record.recordVersion])))
  });
}

function manifestFromArchive(archive) {
  const value = archive?.payload?.closeoutManifest || archive?.raw?.closeout_manifest || {};
  return {
    busIds: Array.isArray(value.busIds) ? value.busIds : [],
    dormIds: Array.isArray(value.dormIds) ? value.dormIds : [],
    soundEventIds: Array.isArray(value.soundEventIds) ? value.soundEventIds : [],
    configIds: Array.isArray(value.configIds) ? value.configIds : [],
    recordVersions: value.recordVersions && typeof value.recordVersions === 'object' ? value.recordVersions : {}
  };
}

function archiveCommandFromSnapshot(snapshot, options = {}) {
  return {
    actorRole: options.actorRole,
    operationId: options.operationId,
    archiveKind: options.archiveKind || 'closeout',
    parentArchiveId: options.parentArchiveId || '',
    amendmentReason: options.amendmentReason || '',
    amendmentNumber: options.amendmentNumber || 0,
    closeoutManifest: options.closeoutManifest || {},
    weekGroup: snapshot.weekGroup,
    archivedAt: snapshot.archivedAt,
    archiveSchemaVersion: snapshot.schemaVersion,
    closeoutSafetyVersion: options.closeoutSafetyVersion || 'build-2-gate-d-verified-closeout-v1',
    totalExpected: snapshot.projected.total,
    totalArrived: snapshot.confirmed.total,
    totalLoaded: snapshot.loaded.total,
    femaleTotal: snapshot.confirmed.female,
    naturalizationTotal: snapshot.confirmed.naturalization,
    spaceForceTotal: snapshot.confirmed.spaceForce,
    busData: snapshot.buses,
    dormData: snapshot.dorms,
    receivingWindows: snapshot.receivingWindows,
    notes: options.notes || ''
  };
}

async function listCloseoutState(repositories, weekGroup) {
  const [buses, dorms, soundEvents, active, lastAirport, activeConfig] = await Promise.all([
    repositories.buses.list({ weekGroup }),
    repositories.dorms.list({ weekGroup }),
    repositories.soundEvents.list({ weekGroup }),
    repositories.config.getActiveWeekGroup(),
    repositories.config.getByKey('last_airport'),
    repositories.config.getByKey('week_group')
  ]);
  const failure = [buses, dorms, soundEvents, active, lastAirport, activeConfig].find(result => !result.ok);
  if (failure) return { ok: false, result: failure };
  return {
    ok: true,
    buses: buses.data,
    dorms: dorms.data,
    soundEvents: soundEvents.data,
    activeWeekGroup: active.data,
    lastAirport: lastAirport.data,
    activeConfig: activeConfig.data
  };
}

async function appendDeletionAudit({ repositories, workflow, operationId, actorRole, occurredAt, weekGroup, entityType, entityId, priorVersion, label }) {
  return appendRequiredAudit({
    repositories,
    workflow,
    operationId,
    command: {
      eventType: 'live_record_cleared',
      entityType,
      entityId,
      weekGroup,
      actorRole,
      occurredAt,
      priorVersion,
      resultingVersion: priorVersion + 1,
      summary: `${label} cleared after verified archive creation`,
      metadata: { deleted: true, label }
    }
  });
}

async function clearEntityRecord({ repositories, repository, record, workflow, operationId, actorRole, occurredAt, weekGroup, entityType, label }) {
  const deleted = await repository.deleteById(record.id, {
    actorRole,
    timestamp: occurredAt
  });
  if (!deleted.ok) {
    return {
      ok: false,
      workflowResult: repositoryStepFailure({
        result: deleted,
        workflow,
        operationId,
        phase: WorkflowPhase.CLEAR,
        message: `${label} could not be cleared after archive verification.`,
        completedSteps: ['archive_created', 'archive_verified', 'archive_audited'],
        pendingSteps: [`delete:${record.id}`, `audit_delete:${record.id}`, 'verify_clear', 'audit_closeout'],
        partial: true,
        recovery: { action: 'resume_closeout', operationId, weekGroup, failedRecordId: record.id }
      })
    };
  }

  const verification = await repository.getById(record.id);
  if (verification.ok || verification.error?.code !== RepositoryErrorCode.NOT_FOUND) {
    return {
      ok: false,
      workflowResult: partialWorkflow({
        workflow,
        operationId,
        phase: WorkflowPhase.VERIFY,
        message: `${label} deletion was acknowledged but absence could not be verified.`,
        error: verification.error || { code: 'verification_failed', message: 'Deleted record is still present.' },
        completedSteps: ['archive_created', 'archive_verified', 'archive_audited', `delete:${record.id}`],
        pendingSteps: [`verify_delete:${record.id}`, `audit_delete:${record.id}`, 'verify_clear', 'audit_closeout'],
        recovery: { action: 'refetch_and_resume_closeout', operationId, weekGroup, recordId: record.id }
      })
    };
  }

  const audited = await appendDeletionAudit({
    repositories,
    workflow,
    operationId,
    actorRole,
    occurredAt,
    weekGroup,
    entityType,
    entityId: record.id,
    priorVersion: record.recordVersion,
    label
  });
  if (!audited.ok) return { ok: false, workflowResult: audited.workflowResult };
  return { ok: true, audit: audited.result.data };
}

async function repairMissingDeletionAudits({ repositories, workflow, operationId, actorRole, occurredAt, weekGroup, archive, currentIds }) {
  const manifest = manifestFromArchive(archive);
  const groups = [
    ['bus', manifest.busIds],
    ['dorm', manifest.dormIds],
    ['sound_event', manifest.soundEventIds],
    ['config', manifest.configIds]
  ];
  for (const [entityType, ids] of groups) {
    for (const id of ids) {
      if (currentIds.has(id)) continue;
      const existing = await repositories.audit.findByOperation({ operationId, eventType: 'live_record_cleared', entityId: id });
      if (!existing.ok) return { ok: false, workflowResult: repositoryStepFailure({
        result: existing,
        workflow,
        operationId,
        phase: WorkflowPhase.AUDIT,
        message: 'Closeout recovery could not inspect prior deletion audits.',
        completedSteps: ['archive_created', 'archive_verified', 'archive_audited'],
        pendingSteps: ['repair_delete_audits', 'verify_clear', 'audit_closeout'],
        partial: true,
        recovery: { action: 'resume_closeout', operationId, weekGroup }
      }) };
      if (existing.data) continue;
      const priorVersion = Number(manifest.recordVersions?.[id] || 0);
      const audited = await appendDeletionAudit({
        repositories,
        workflow,
        operationId,
        actorRole,
        occurredAt,
        weekGroup,
        entityType,
        entityId: id,
        priorVersion,
        label: `${entityType} ${id}`
      });
      if (!audited.ok) return { ok: false, workflowResult: audited.workflowResult };
    }
  }
  return { ok: true };
}

async function clearConfigRecord({ repositories, workflow, operationId, actorRole, occurredAt, weekGroup, key, record }) {
  if (!record || !record.payload.value) return { ok: true, unchanged: true };
  const cleared = await repositories.config.clear(key, { actorRole, updatedAt: occurredAt });
  if (!cleared.ok) return { ok: false, workflowResult: repositoryStepFailure({
    result: cleared,
    workflow,
    operationId,
    phase: WorkflowPhase.CLEAR,
    message: `Configuration ${key} could not be cleared.`,
    completedSteps: ['archive_created', 'archive_verified', 'archive_audited'],
    pendingSteps: [`clear_config:${key}`, `audit_config:${key}`, 'verify_clear', 'audit_closeout'],
    partial: true,
    recovery: { action: 'resume_closeout', operationId, weekGroup, configKey: key }
  }) };

  const verified = await repositories.config.getByKey(key);
  if (!verified.ok || verified.data?.payload?.value) return { ok: false, workflowResult: partialWorkflow({
    workflow,
    operationId,
    phase: WorkflowPhase.VERIFY,
    message: `Configuration ${key} clear could not be verified.`,
    error: verified.error || { code: 'verification_failed', message: 'Configuration value remains present.' },
    completedSteps: ['archive_created', 'archive_verified', 'archive_audited', `clear_config:${key}`],
    pendingSteps: [`verify_config:${key}`, `audit_config:${key}`, 'verify_clear', 'audit_closeout'],
    recovery: { action: 'refetch_and_resume_closeout', operationId, weekGroup, configKey: key }
  }) };

  const audited = await appendDeletionAudit({
    repositories,
    workflow,
    operationId,
    actorRole,
    occurredAt,
    weekGroup,
    entityType: 'config',
    entityId: record.id,
    priorVersion: record.recordVersion,
    label: `Configuration ${key}`
  });
  if (!audited.ok) return { ok: false, workflowResult: audited.workflowResult };
  return { ok: true, audit: audited.result.data };
}

export async function closeoutWeekGroupWorkflow({ repositories, command = {}, clock } = {}) {
  requireRepositories(repositories, ['buses', 'dorms', 'soundEvents', 'config', 'archives', 'audit']);
  const workflow = 'closeout_week_group';
  const operationId = normalizeText(command.operationId) || createOperationId(workflow);
  const weekGroup = normalizeWeekGroup(command.weekGroup);
  const occurredAt = command.archivedAt || timestampFrom(clock);
  if (!weekGroup) return blockedWorkflow({
    workflow,
    operationId,
    phase: WorkflowPhase.VALIDATE,
    message: 'Week Group is required for closeout.',
    error: { code: 'validation_error', message: 'Week Group is required.' },
    pendingSteps: ['load', 'archive', 'verify_archive', 'audit_archive', 'clear', 'verify_clear', 'audit_closeout']
  });

  let state = await listCloseoutState(repositories, weekGroup);
  if (!state.ok) return repositoryStepFailure({
    result: state.result,
    workflow,
    operationId,
    phase: WorkflowPhase.LOAD,
    message: 'Authoritative closeout records could not be loaded.',
    completedSteps: [],
    pendingSteps: ['archive', 'verify_archive', 'audit_archive', 'clear', 'verify_clear', 'audit_closeout']
  });
  if (state.activeWeekGroup && state.activeWeekGroup !== weekGroup) return blockedWorkflow({
    workflow,
    operationId,
    phase: WorkflowPhase.VALIDATE,
    message: `Active Week Group ${state.activeWeekGroup} does not match requested closeout ${weekGroup}.`,
    error: { code: 'active_week_group_conflict', message: 'Requested Week Group is not active.' },
    pendingSteps: ['select_active_week_group']
  });

  const existingFinalAudit = await repositories.audit.findByOperation({
    operationId,
    eventType: 'week_group_closeout_completed',
    entityId: weekGroup
  });
  if (existingFinalAudit.ok && existingFinalAudit.data && !state.buses.length && !state.dorms.length && !state.soundEvents.length && !state.activeWeekGroup) {
    const existingArchive = await repositories.archives.findByOperation(operationId);
    return completeWorkflow({
      workflow,
      operationId,
      message: `${weekGroup} closeout was already completed by this operation.`,
      data: { archive: existingArchive.ok ? existingArchive.data : null, audit: existingFinalAudit.data },
      completedSteps: ['archive', 'verify_archive', 'audit_archive', 'clear', 'verify_clear', 'audit_closeout'],
      unchanged: true
    });
  }

  let archiveResult = await repositories.archives.findByOperation(operationId);
  if (!archiveResult.ok) return repositoryStepFailure({
    result: archiveResult,
    workflow,
    operationId,
    phase: WorkflowPhase.LOAD,
    message: 'Existing closeout archive state could not be inspected.',
    completedSteps: ['load'],
    pendingSteps: ['archive', 'verify_archive', 'audit_archive', 'clear', 'verify_clear', 'audit_closeout']
  });

  let archive = archiveResult.data;
  if (!archive) {
    if (!state.buses.length && !state.dorms.length) return blockedWorkflow({
      workflow,
      operationId,
      phase: WorkflowPhase.VALIDATE,
      message: 'No live bus or dorm records exist to archive.',
      error: { code: 'no_live_records', message: 'Closeout requires live operational records.' },
      pendingSteps: ['review_week_group']
    });

    const snapshot = buildArchiveSnapshot({
      records: [...state.buses, ...state.dorms],
      weekGroup,
      windows: command.receivingWindows || {},
      archivedAt: occurredAt,
      generatedAt: occurredAt
    });
    const manifest = manifestFor({
      buses: state.buses,
      dorms: state.dorms,
      soundEvents: state.soundEvents,
      configs: [state.lastAirport, state.activeConfig]
    });
    const created = await repositories.archives.createSnapshot(archiveCommandFromSnapshot(snapshot, {
      actorRole: command.actorRole,
      operationId,
      archiveKind: 'closeout',
      closeoutManifest: manifest,
      notes: command.notes
    }));
    if (!created.ok) return repositoryStepFailure({
      result: created,
      workflow,
      operationId,
      phase: WorkflowPhase.PERSIST,
      message: 'Archive creation failed. No live records were cleared.',
      completedSteps: ['load'],
      pendingSteps: ['archive', 'verify_archive', 'audit_archive', 'clear', 'verify_clear', 'audit_closeout']
    });
    archive = created.data;
  }

  const verifiedArchive = await verifyRecord(repositories.archives, archive.id, record => (
    record.weekGroup === weekGroup
    && record.payload.operationId === operationId
    && record.payload.archiveKind === 'closeout'
  ));
  if (!verifiedArchive.ok) return partialWorkflow({
    workflow,
    operationId,
    phase: WorkflowPhase.VERIFY,
    message: 'Archive may exist, but backend verification failed. Live records were not cleared.',
    error: verifiedArchive.error,
    data: { archiveId: archive.id },
    completedSteps: ['load', 'archive'],
    pendingSteps: ['verify_archive', 'audit_archive', 'clear', 'verify_clear', 'audit_closeout'],
    recovery: { action: 'refetch_and_resume_closeout', operationId, weekGroup, archiveId: archive.id }
  });
  archive = verifiedArchive.data;

  const archiveAudit = await appendRequiredAudit({
    repositories,
    workflow,
    operationId,
    completedSteps: ['load', 'archive', 'verify_archive'],
    pendingSteps: ['clear', 'verify_clear', 'audit_closeout'],
    command: {
      eventType: 'archive_created',
      entityType: 'archive',
      entityId: archive.id,
      weekGroup,
      actorRole: command.actorRole,
      occurredAt,
      priorVersion: 0,
      resultingVersion: archive.recordVersion,
      summary: `Verified closeout archive created for ${weekGroup}`,
      metadata: {
        totalExpected: archive.payload.totalExpected,
        totalArrived: archive.payload.totalArrived,
        totalLoaded: archive.payload.totalLoaded
      }
    }
  });
  if (!archiveAudit.ok) return archiveAudit.workflowResult;

  const currentIds = new Set([
    ...state.buses,
    ...state.dorms,
    ...state.soundEvents,
    state.lastAirport,
    state.activeConfig
  ].filter(Boolean).map(record => record.id));
  const repaired = await repairMissingDeletionAudits({
    repositories,
    workflow,
    operationId,
    actorRole: command.actorRole,
    occurredAt,
    weekGroup,
    archive,
    currentIds
  });
  if (!repaired.ok) return repaired.workflowResult;

  for (const record of state.dorms) {
    const result = await clearEntityRecord({ repositories, repository: repositories.dorms, record, workflow, operationId, actorRole: command.actorRole, occurredAt, weekGroup, entityType: 'dorm', label: `Dorm ${record.payload.name}` });
    if (!result.ok) return result.workflowResult;
  }
  for (const record of state.buses) {
    const result = await clearEntityRecord({ repositories, repository: repositories.buses, record, workflow, operationId, actorRole: command.actorRole, occurredAt, weekGroup, entityType: 'bus', label: `Bus ${record.payload.busId || record.id}` });
    if (!result.ok) return result.workflowResult;
  }
  for (const record of state.soundEvents) {
    const result = await clearEntityRecord({ repositories, repository: repositories.soundEvents, record, workflow, operationId, actorRole: command.actorRole, occurredAt, weekGroup, entityType: 'sound_event', label: `Sound event ${record.id}` });
    if (!result.ok) return result.workflowResult;
  }

  const lastAirportClear = await clearConfigRecord({ repositories, workflow, operationId, actorRole: command.actorRole, occurredAt, weekGroup, key: 'last_airport', record: state.lastAirport });
  if (!lastAirportClear.ok) return lastAirportClear.workflowResult;
  const activeClear = await clearConfigRecord({ repositories, workflow, operationId, actorRole: command.actorRole, occurredAt, weekGroup, key: 'week_group', record: state.activeConfig });
  if (!activeClear.ok) return activeClear.workflowResult;

  state = await listCloseoutState(repositories, weekGroup);
  if (!state.ok || state.buses.length || state.dorms.length || state.soundEvents.length || state.activeWeekGroup || state.lastAirport?.payload?.value) {
    return partialWorkflow({
      workflow,
      operationId,
      phase: WorkflowPhase.VERIFY,
      message: 'Archive is verified, but live-record clearing is incomplete.',
      error: state.result?.error || {
        code: 'closeout_clear_incomplete',
        message: 'One or more live records or configuration values remain.',
        details: state.ok ? {
          buses: state.buses.map(record => record.id),
          dorms: state.dorms.map(record => record.id),
          soundEvents: state.soundEvents.map(record => record.id),
          activeWeekGroup: state.activeWeekGroup,
          lastAirport: state.lastAirport?.payload?.value || ''
        } : null
      },
      data: { archive },
      completedSteps: ['archive', 'verify_archive', 'audit_archive', 'clear'],
      pendingSteps: ['verify_clear', 'audit_closeout'],
      recovery: { action: 'resume_closeout', operationId, weekGroup, archiveId: archive.id }
    });
  }

  const finalAudit = await appendRequiredAudit({
    repositories,
    workflow,
    operationId,
    completedSteps: ['archive', 'verify_archive', 'audit_archive', 'clear', 'verify_clear'],
    command: {
      eventType: 'week_group_closeout_completed',
      entityType: 'week_group',
      entityId: weekGroup,
      weekGroup,
      actorRole: command.actorRole,
      occurredAt,
      priorVersion: archive.recordVersion,
      resultingVersion: archive.recordVersion,
      summary: `${weekGroup} archived, verified, and cleared`,
      metadata: { archiveId: archive.id }
    }
  });
  if (!finalAudit.ok) return finalAudit.workflowResult;

  return completeWorkflow({
    workflow,
    operationId,
    message: `${weekGroup} archive was verified and all eligible live records were cleared.`,
    data: { archive, audit: finalAudit.result.data },
    completedSteps: ['archive', 'verify_archive', 'audit_archive', 'clear', 'verify_clear', 'audit_closeout']
  });
}

export async function amendArchiveWorkflow({ repositories, command = {}, clock } = {}) {
  requireRepositories(repositories, ['archives', 'audit']);
  const workflow = 'amend_archive';
  const operationId = normalizeText(command.operationId) || createOperationId(workflow);
  const reason = normalizeText(command.reason);
  if (!normalizeText(command.parentArchiveId) || !reason) return blockedWorkflow({
    workflow,
    operationId,
    phase: WorkflowPhase.VALIDATE,
    message: 'Archive amendment requires a parent archive and reason.',
    error: { code: 'validation_error', message: 'Parent archive id and amendment reason are required.' },
    pendingSteps: ['load_parent', 'create_amendment', 'verify_amendment', 'audit_amendment']
  });

  const existing = await repositories.archives.findByOperation(operationId);
  if (existing.ok && existing.data) {
    const audit = await repositories.audit.findByOperation({ operationId, eventType: 'archive_amended', entityId: existing.data.id });
    if (audit.ok && audit.data) return completeWorkflow({
      workflow,
      operationId,
      message: 'This archive amendment operation was already completed.',
      data: { archive: existing.data, audit: audit.data },
      completedSteps: ['load_parent', 'create_amendment', 'verify_amendment', 'audit_amendment'],
      unchanged: true
    });
  }

  const parent = await repositories.archives.getById(command.parentArchiveId);
  if (!parent.ok) return repositoryStepFailure({
    result: parent,
    workflow,
    operationId,
    phase: WorkflowPhase.LOAD,
    message: 'The parent archive could not be loaded.',
    completedSteps: [],
    pendingSteps: ['create_amendment', 'verify_amendment', 'audit_amendment']
  });

  const snapshot = command.snapshot;
  const validation = validateArchiveSnapshot(snapshot);
  if (!validation.valid || snapshot.weekGroup !== parent.data.weekGroup) return blockedWorkflow({
    workflow,
    operationId,
    phase: WorkflowPhase.VALIDATE,
    message: 'The amendment snapshot is invalid or belongs to another Week Group.',
    error: { code: 'validation_error', message: 'Invalid amendment snapshot.', details: validation.errors },
    completedSteps: ['load_parent'],
    pendingSteps: ['create_amendment', 'verify_amendment', 'audit_amendment']
  });

  const occurredAt = command.amendedAt || timestampFrom(clock);
  const created = await repositories.archives.createSnapshot(archiveCommandFromSnapshot(snapshot, {
    actorRole: command.actorRole,
    operationId,
    archiveKind: 'amendment',
    parentArchiveId: parent.data.id,
    amendmentReason: reason,
    amendmentNumber: Number(parent.data.payload.amendmentNumber || 0) + 1,
    notes: command.notes,
    closeoutSafetyVersion: 'build-2-gate-d-immutable-amendment-v1'
  }));
  if (!created.ok) return repositoryStepFailure({
    result: created,
    workflow,
    operationId,
    phase: WorkflowPhase.PERSIST,
    message: 'The amendment archive could not be created.',
    completedSteps: ['load_parent'],
    pendingSteps: ['create_amendment', 'verify_amendment', 'audit_amendment']
  });

  const verified = await verifyRecord(repositories.archives, created.data.id, record => (
    record.payload.archiveKind === 'amendment'
    && record.payload.parentArchiveId === parent.data.id
    && record.payload.amendmentReason === reason
    && record.payload.operationId === operationId
  ));
  if (!verified.ok) return partialWorkflow({
    workflow,
    operationId,
    phase: WorkflowPhase.VERIFY,
    message: 'Amendment archive may exist, but verification failed.',
    error: verified.error,
    data: { archiveId: created.data.id, parentArchiveId: parent.data.id },
    completedSteps: ['load_parent', 'create_amendment'],
    pendingSteps: ['verify_amendment', 'audit_amendment'],
    recovery: { action: 'refetch_and_verify_amendment', operationId, archiveId: created.data.id }
  });

  const audit = await appendRequiredAudit({
    repositories,
    workflow,
    operationId,
    completedSteps: ['load_parent', 'create_amendment', 'verify_amendment'],
    command: {
      eventType: 'archive_amended',
      entityType: 'archive',
      entityId: verified.data.id,
      weekGroup: verified.data.weekGroup,
      actorRole: command.actorRole,
      occurredAt,
      priorVersion: parent.data.recordVersion,
      resultingVersion: verified.data.recordVersion,
      summary: `Archive ${parent.data.id} amended: ${reason}`,
      metadata: { parentArchiveId: parent.data.id, reason, amendmentNumber: verified.data.payload.amendmentNumber }
    }
  });
  if (!audit.ok) return audit.workflowResult;

  return completeWorkflow({
    workflow,
    operationId,
    message: 'Archive amendment was created without modifying the parent archive.',
    data: { parentArchive: parent.data, amendmentArchive: verified.data, audit: audit.result.data },
    completedSteps: ['load_parent', 'create_amendment', 'verify_amendment', 'audit_amendment']
  });
}
