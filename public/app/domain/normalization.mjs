export function normalizeText(value) {
  return String(value ?? '').trim();
}

export function normalizeWeekGroup(value) {
  return normalizeText(value).toUpperCase();
}

export function normalizeDormIdentityPart(value) {
  return normalizeText(value).replace(/\s+/g, ' ').toUpperCase();
}

function canonicalPayload(record = {}, expectedType = '') {
  const type = normalizeText(record?.type).toLowerCase();
  if (expectedType && type !== expectedType) return null;
  return record?.payload && typeof record.payload === 'object' ? record.payload : null;
}

export function createDormIdentity(record = {}) {
  const payload = canonicalPayload(record, 'dorm') || record;
  const rowIndex = Number(payload.rowIndex);
  const fallbackName = Number.isFinite(rowIndex) ? `Dorm ${rowIndex + 1}` : '';
  const squadron = normalizeDormIdentityPart(payload.sdq);
  const dorm = normalizeDormIdentityPart(normalizeText(payload.name) || fallbackName);

  return Object.freeze({
    squadron,
    dorm,
    key: `${squadron}::${dorm}`
  });
}

export function findDuplicateDormIdentity(records = []) {
  const seen = new Set();
  for (const record of Array.isArray(records) ? records : []) {
    const identity = createDormIdentity(record);
    if (seen.has(identity.key)) return identity;
    seen.add(identity.key);
  }
  return null;
}

export function toNonNegativeNumber(value, { integer = true } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const clamped = Math.max(0, parsed);
  return integer ? Math.trunc(clamped) : clamped;
}

export function normalizeTimestamp(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  if (!hasExplicitZone) return null;
  const milliseconds = Date.parse(raw);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString();
}

export function normalizeStatus(value) {
  const status = normalizeText(value).toLowerCase().replace(/[_-]+/g, ' ');
  if (status === 'arrived') return 'arrived';
  if (['active', 'otw', 'en route', 'enroute'].includes(status)) return 'active';
  return status || 'unknown';
}

export function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

export function normalizeBusRecord(entity = {}) {
  const payload = canonicalPayload(entity, 'bus');
  if (!payload) return null;
  const total = toNonNegativeNumber(payload.total);
  const female = Math.min(toNonNegativeNumber(payload.female), total);
  const naturalization = Math.min(toNonNegativeNumber(payload.naturalization), total);
  const spaceForce = Math.min(toNonNegativeNumber(payload.spaceForce), total);
  const status = normalizeStatus(payload.status);
  const arrivedAt = normalizeTimestamp(payload.arrivedAt);

  return Object.freeze({
    id: normalizeText(entity.id),
    type: 'bus',
    schemaVersion: normalizeText(entity.schemaVersion),
    recordVersion: toNonNegativeNumber(entity.recordVersion),
    weekGroup: normalizeWeekGroup(entity.weekGroup),
    createdByRole: normalizeText(entity.createdByRole).toLowerCase() || 'unknown',
    updatedByRole: normalizeText(entity.updatedByRole).toLowerCase() || 'unknown',
    busId: normalizeText(payload.busId),
    busType: normalizeText(payload.busType || 'airport').toLowerCase(),
    destination: normalizeText(payload.destination),
    originatingDestination: normalizeText(payload.originatingDestination),
    status,
    total,
    female,
    naturalization,
    spaceForce,
    airForce: Math.max(total - spaceForce, 0),
    createdAt: normalizeTimestamp(payload.createdAt || entity.createdAt),
    departedAt: normalizeTimestamp(payload.departedAt),
    arrivedAt,
    isConfirmedArrival: status === 'arrived' && Boolean(arrivedAt),
    isActive: status === 'active'
  });
}

export function normalizeDormRecord(entity = {}) {
  const payload = canonicalPayload(entity, 'dorm');
  if (!payload) return null;
  const capacity = toNonNegativeNumber(payload.capacity);
  const load = Math.min(toNonNegativeNumber(payload.load), capacity);

  return Object.freeze({
    id: normalizeText(entity.id),
    type: 'dorm',
    schemaVersion: normalizeText(entity.schemaVersion),
    recordVersion: toNonNegativeNumber(entity.recordVersion),
    weekGroup: normalizeWeekGroup(entity.weekGroup),
    createdByRole: normalizeText(entity.createdByRole).toLowerCase() || 'unknown',
    updatedByRole: normalizeText(entity.updatedByRole).toLowerCase() || 'unknown',
    name: normalizeText(payload.name),
    sdq: normalizeText(payload.sdq),
    section: normalizeText(payload.section),
    interSection: normalizeText(payload.interSection),
    sex: normalizeText(payload.sex).toLowerCase(),
    band: normalizeBoolean(payload.band),
    capacity,
    load,
    spaceForce: normalizeBoolean(payload.spaceForce),
    state: normalizeText(payload.state || 'empty').toLowerCase(),
    phase: normalizeText(payload.phase),
    openedAt: normalizeTimestamp(payload.openedAt),
    closedAt: normalizeTimestamp(payload.closedAt),
    closedTimer: normalizeText(payload.closedTimer),
    assignedStaff: normalizeText(payload.assignedStaff),
    auditoriumLocation: normalizeText(payload.auditoriumLocation),
    notes: normalizeText(payload.notes),
    receivingWindows: Object.freeze({ ...(payload.receivingWindows || {}) })
  });
}

export function matchesWeekGroup(normalizedRecord, weekGroup) {
  const requested = normalizeWeekGroup(weekGroup);
  return !requested || normalizedRecord?.weekGroup === requested;
}
