import { normalizeText, normalizeWeekGroup } from './normalization.mjs';
import { buildReceivingReportModel, calculateReceivingSummary } from './receiving.mjs';

export const RECEIVING_DOCUMENT_CONTEXTS = Object.freeze(['current', 'archive']);

export function buildReceivingDocumentModel({
  records = [],
  weekGroup = '',
  windows = {},
  context = 'current',
  generatedAt = '',
  archivedAt = ''
} = {}) {
  const normalizedContext = RECEIVING_DOCUMENT_CONTEXTS.includes(context) ? context : 'current';
  const summary = calculateReceivingSummary({ records, weekGroup, windows });
  const report = buildReceivingReportModel(summary);
  return Object.freeze({
    context: normalizedContext,
    weekGroup: normalizeWeekGroup(weekGroup),
    generatedAt: normalizeText(generatedAt),
    archivedAt: normalizedContext === 'archive' ? normalizeText(archivedAt) : '',
    summary,
    report
  });
}

export function buildCurrentSummaryModel(options = {}) {
  return buildReceivingDocumentModel({ ...options, context: 'current', archivedAt: '' });
}

export function buildArchiveReportModel(options = {}) {
  return buildReceivingDocumentModel({ ...options, context: 'archive' });
}
