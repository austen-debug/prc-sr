import { normalizeText, normalizeWeekGroup } from './normalization.mjs';

export const ACTIVE_WEEK_GROUP_CONFIG_KEY = 'week_group';

export function validateWeekGroupId(value) {
  const weekGroup = normalizeWeekGroup(value);
  const errors = [];
  if (!weekGroup) errors.push('Week Group is required.');
  if (weekGroup.length > 64) errors.push('Week Group may not exceed 64 characters.');
  return Object.freeze({ valid: errors.length === 0, weekGroup, errors: Object.freeze(errors) });
}

export function selectActiveWeekGroup(records = []) {
  const configs = (Array.isArray(records) ? records : [])
    .filter(record => normalizeText(record?.type).toLowerCase() === 'config')
    .filter(record => normalizeText(record?.payload?.key).toLowerCase() === ACTIVE_WEEK_GROUP_CONFIG_KEY);

  for (let index = configs.length - 1; index >= 0; index -= 1) {
    const weekGroup = normalizeWeekGroup(configs[index]?.payload?.value);
    if (weekGroup) return weekGroup;
  }
  return '';
}

export function filterRecordsByWeekGroup(records = [], weekGroup = '') {
  const requested = normalizeWeekGroup(weekGroup);
  if (!requested) return Object.freeze([]);
  return Object.freeze((Array.isArray(records) ? records : []).filter(record => (
    normalizeWeekGroup(record?.weekGroup) === requested
  )));
}

export function buildWeekGroupContext(records = [], requestedWeekGroup = '') {
  const activeWeekGroup = selectActiveWeekGroup(records);
  const validation = validateWeekGroupId(requestedWeekGroup || activeWeekGroup);
  return Object.freeze({
    activeWeekGroup,
    requestedWeekGroup: validation.weekGroup,
    valid: validation.valid,
    errors: validation.errors,
    records: validation.valid ? filterRecordsByWeekGroup(records, validation.weekGroup) : Object.freeze([])
  });
}
