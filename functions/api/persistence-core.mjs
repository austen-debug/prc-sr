// Pure GATE persistence validation and snapshot construction. No browser state or SQL.
const WINDOW_KEYS = Object.freeze([
  'receiving_day_one_start', 'receiving_day_one_end',
  'receiving_day_two_start', 'receiving_day_two_end'
]);
const text = (value, max = 100) => String(value ?? '').trim().slice(0, max);
const number = value => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
const flag = value => value === true || value === 'true' || value === 1 || value === '1';

export class PersistenceValidationError extends Error {
  constructor(message) { super(message); this.name = 'PersistenceValidationError'; }
}

export function normalizeDraft(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new PersistenceValidationError('Draft must be an object.');
  const proposedWeekGroup = text(payload.proposed_week_group, 24).toUpperCase();
  if (proposedWeekGroup && !/^[A-Z0-9_-]{1,24}$/.test(proposedWeekGroup)) throw new PersistenceValidationError('Invalid Week Group identifier.');
  if (!Array.isArray(payload.rows) || payload.rows.length > 100) throw new PersistenceValidationError('Draft must contain at most 100 rows.');
  const rows = payload.rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new PersistenceValidationError(`Invalid row ${index + 1}.`);
    const load = row.load === '' || row.load === null || row.load === undefined ? '' : Number(row.load);
    if (load !== '' && (!Number.isInteger(load) || load < 0 || load > 100)) throw new PersistenceValidationError(`Invalid load on row ${index + 1}.`);
    const band = flag(row.band);
    const spaceForce = flag(row.space_force);
    if (band && spaceForce) throw new PersistenceValidationError(`Row ${index + 1} cannot be both Band and Space Force.`);
    return {
      rowIndex: index, sdq: text(row.sdq, 48), sec: text(row.sec, 48),
      inter_sec: text(row.inter_sec, 64), dorm_name: text(row.dorm_name, 80),
      sex: row.sex === 'female' ? 'female' : 'male', band, space_force: spaceForce,
      load
    };
  });
  const supplied = payload.receiving_windows;
  if (supplied !== undefined && (!supplied || typeof supplied !== 'object' || Array.isArray(supplied))) throw new PersistenceValidationError('Receiving windows must be an object.');
  const windows = {};
  for (const key of WINDOW_KEYS) windows[key] = text(supplied?.[key], 40);
  for (const [startKey, endKey] of [[WINDOW_KEYS[0], WINDOW_KEYS[1]], [WINDOW_KEYS[2], WINDOW_KEYS[3]]]) {
    const start = windows[startKey], end = windows[endKey];
    if (Boolean(start) !== Boolean(end)) throw new PersistenceValidationError('Both start and end of each receiving window are required.');
    if (start && (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(start) >= Date.parse(end))) {
      throw new PersistenceValidationError('Receiving window end must be later than start.');
    }
  }
  if (windows.receiving_day_one_end && windows.receiving_day_two_start && Date.parse(windows.receiving_day_two_start) < Date.parse(windows.receiving_day_one_end)) {
    throw new PersistenceValidationError('Receiving Day Two cannot precede Day One.');
  }
  const review = payload.import_review && typeof payload.import_review === 'object' && !Array.isArray(payload.import_review) ? payload.import_review : {};
  const published = review.published_total === '' || review.published_total === undefined || review.published_total === null ? null : Number(review.published_total);
  if (published !== null && (!Number.isInteger(published) || published < 0 || published > 100000)) throw new PersistenceValidationError('Invalid published total.');
  return {
    proposed_week_group: proposedWeekGroup,
    rows,
    receiving_windows: windows,
    import_review: {
      published_total: published,
      band_decision: ['none', 'some'].includes(review.band_decision) ? review.band_decision : null
    }
  };
}

export function validateInitialization(draft) {
  if (!draft.proposed_week_group) throw new PersistenceValidationError('Week Group ID is required.');
  const populated = draft.rows.filter(row => row.sdq || row.sec || row.inter_sec || row.dorm_name || row.load !== '');
  if (!populated.length) throw new PersistenceValidationError('At least one dorm must be configured.');
  const seen = new Set();
  for (const row of populated) {
    if (!Number.isInteger(row.load) || row.load < 1 || row.load > 100) throw new PersistenceValidationError('Each configured dorm requires a load from 1 to 100.');
    const key = `${row.sdq.toUpperCase()}::${(row.dorm_name || `DORM ${row.rowIndex + 1}`).toUpperCase()}`;
    if (seen.has(key)) throw new PersistenceValidationError(`Duplicate Squadron/Dorm: ${key}.`);
    seen.add(key);
  }
  return populated;
}

export function buildDormRows(draft, cycleId, now, makeId) {
  return validateInitialization(draft).map(row => {
    const name = row.dorm_name || `Dorm ${row.rowIndex + 1}`;
    const order = row.rowIndex + 1;
    const id = makeId();
    const data = {
      ...draft.receiving_windows,
      type: 'dorm', week_group: draft.proposed_week_group, cycle_id: cycleId,
      dorm_name: name, sdq: row.sdq, section: row.sec, inter_sec: row.inter_sec,
      max_load: row.load, current_load: 0, sex: row.sex,
      band: row.band ? 'true' : 'false',
      space_force: row.space_force ? 'true' : 'false', is_space_force: row.space_force ? 'true' : 'false',
      display_order: order, input_order: order, source_row_index: row.rowIndex,
      dorm_identity: `${draft.proposed_week_group}::${row.sdq.toUpperCase()}::${name.toUpperCase()}`,
      state: 'empty', phase: '', opened_at: '', closed_timer: '', closed_at: '',
      notes: '', assigned_airman: '', auditorium_location: '',
      overtime_sound_sent: 'false', overtime_sound_at: '', destination: '', bus_type: '',
      __backendId: id, record_version: 1, created_by_role: 'instructor', updated_by_role: 'instructor',
      created_at: now, updated_at: now
    };
    return { id, type: 'dorm', week_group: draft.proposed_week_group, data: JSON.stringify(data), created_at: now, updated_at: now };
  });
}

export function parseOperationalRow(row) {
  let data;
  try { data = JSON.parse(row.data); } catch { throw new PersistenceValidationError(`Invalid stored JSON for record ${row.id}.`); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || (data.type && data.type !== row.type)) throw new PersistenceValidationError(`Invalid stored payload for record ${row.id}.`);
  return { ...data, type: row.type, week_group: row.week_group, __backendId: row.id };
}

export function buildArchivePayload({ cycleId, weekGroup, dorms, buses, windows = {}, now }) {
  const arrived = buses.filter(bus => bus.status === 'arrived');
  const dormHistory = dorms.map(dorm => ({
    ...windows, name: dorm.dorm_name || '', dorm_name: dorm.dorm_name || '',
    sdq: dorm.sdq || '', section: dorm.section || '', inter_sec: dorm.inter_sec || '',
    sex: dorm.sex || '', band: dorm.band || 'false',
    space_force: dorm.space_force || dorm.is_space_force || 'false',
    is_space_force: dorm.is_space_force || dorm.space_force || 'false',
    display_order: dorm.display_order, input_order: dorm.input_order,
    source_row_index: dorm.source_row_index, dorm_identity: dorm.dorm_identity || '',
    auditorium_location: dorm.auditorium_location || '',
    current_load: number(dorm.current_load), max_load: number(dorm.max_load),
    state: dorm.state || '', phase: dorm.phase || '', notes: dorm.notes || '',
    assigned_airman: dorm.assigned_airman || '', opened_at: dorm.opened_at || '',
    closed_at: dorm.closed_at || '', closed_timer: dorm.closed_timer || ''
  }));
  const busHistory = buses.map(bus => ({
    bus_id: bus.bus_id || '', bus_type: bus.bus_type || 'airport',
    originating_destination: bus.originating_destination || bus.destination || '',
    destination: bus.destination || '', departed_at: bus.departed_at || bus.created_at || '',
    created_at: bus.created_at || '', arrived_at: bus.arrived_at || '',
    otw_count: number(bus.otw_count), female_count: number(bus.female_count),
    nat_count: number(bus.nat_count), space_force_count: number(bus.space_force_count),
    status: bus.status || ''
  }));
  const sum = (items, key) => items.reduce((total, item) => total + number(item[key]), 0);
  return {
    ...windows, type: 'archive', cycle_id: cycleId, week_group: weekGroup, archived_at: now,
    dorm_count: dorms.length, bus_count: buses.length,
    total_arrived: sum(arrived, 'otw_count'), total_loaded: sum(dorms, 'current_load'),
    total_expected: sum(dorms, 'max_load'), female_total: sum(arrived, 'female_count'),
    nat_total: sum(arrived, 'nat_count'), space_force_total: sum(buses, 'space_force_count'),
    arrived_space_force_total: sum(arrived, 'space_force_count'),
    dorm_data: JSON.stringify(dormHistory), bus_data: JSON.stringify(busHistory),
    archive_schema_version: 'gate-archive-schema-v3-canonical',
    closeout_safety_version: 'archive-verified-before-clear-v3',
    record_version: 1, created_by_role: 'instructor', updated_by_role: 'instructor',
    created_at: now, updated_at: now
  };
}
