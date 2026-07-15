import { normalizeText } from '../domain/normalization.mjs';
import {
  WorkflowPhase,
  completeWorkflow,
  createOperationId
} from './workflow-result.mjs';
import {
  requireRepositories,
  repositoryStepFailure
} from './workflow-helpers.mjs';

export async function retryRequiredAuditWorkflow({ repositories, command = {} } = {}) {
  requireRepositories(repositories, ['audit']);
  const workflow = 'retry_required_audit';
  const operationId = normalizeText(command.operationId || command.auditCommand?.metadata?.operationId)
    || createOperationId(workflow);
  const auditCommand = {
    ...(command.auditCommand || {}),
    metadata: {
      ...(command.auditCommand?.metadata || {}),
      operationId
    }
  };
  const result = await repositories.audit.appendOnce(auditCommand);
  if (!result.ok) return repositoryStepFailure({
    result,
    workflow,
    operationId,
    phase: WorkflowPhase.AUDIT,
    message: 'The required audit event could not be appended.',
    completedSteps: [],
    pendingSteps: ['append_required_audit'],
    recovery: { action: 'retry_audit', auditCommand }
  });
  return completeWorkflow({
    workflow,
    operationId,
    message: result.meta?.unchanged ? 'The required audit event already exists.' : 'The required audit event was appended.',
    data: { audit: result.data },
    completedSteps: ['append_required_audit'],
    unchanged: Boolean(result.meta?.unchanged)
  });
}
