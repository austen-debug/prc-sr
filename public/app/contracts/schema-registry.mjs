export const GATE_SCHEMA_VERSION = 3;
export const GATE_SCHEMA_ID = 'gate-record-v3';

export const RECORD_TYPES = Object.freeze({
  BUS: 'bus',
  DORM: 'dorm',
  WEEK_GROUP: 'week_group',
  CONFIG: 'config',
  ARCHIVE: 'archive',
  AUDIT: 'audit'
});

export const RECORD_STATUSES = Object.freeze({
  BUS: Object.freeze(['active', 'arrived', 'cancelled']),
  DORM: Object.freeze(['empty', 'open', 'closed']),
  ARCHIVE: Object.freeze(['open', 'closed'])
});

export const ENVELOPE_FIELDS = Object.freeze([
  'id',
  'type',
  'schema_version',
  'record_version',
  'week_group',
  'created_at',
  'updated_at',
  'created_by_role',
  'updated_by_role',
  'data'
]);

export const SCHEMAS = Object.freeze({
  bus: Object.freeze({
    type: RECORD_TYPES.BUS,
    required: Object.freeze(['bus_id', 'status', 'otw_count']),
    fields: Object.freeze({
      bus_id: 'string', bus_type: 'string', status: 'string', otw_count: 'integer',
      female_count: 'integer', nat_count: 'integer', space_force_count: 'integer',
      departed_at: 'timestamp|null', arrived_at: 'timestamp|null', driver: 'string', notes: 'string'
    })
  }),
  dorm: Object.freeze({
    type: RECORD_TYPES.DORM,
    required: Object.freeze(['dorm_name', 'state', 'max_load']),
    fields: Object.freeze({
      dorm_name: 'string', sdq: 'string', state: 'string', phase: 'string', max_load: 'integer',
      current_load: 'integer', female: 'boolean', band: 'boolean', space_force: 'boolean',
      auditorium_location: 'string', opened_at: 'timestamp|null', closed_at: 'timestamp|null',
      final_processing_time: 'timestamp|null', closed_timer: 'string', display_order: 'integer|null'
    })
  }),
  week_group: Object.freeze({
    type: RECORD_TYPES.WEEK_GROUP,
    required: Object.freeze(['week_group', 'projected_total']),
    fields: Object.freeze({
      week_group: 'string', projected_total: 'integer', active: 'boolean', initialized_at: 'timestamp|null'
    })
  }),
  config: Object.freeze({
    type: RECORD_TYPES.CONFIG,
    required: Object.freeze(['receiving_night_one_start', 'receiving_night_one_end', 'receiving_night_two_start', 'receiving_night_two_end']),
    fields: Object.freeze({
      receiving_night_one_start: 'timestamp', receiving_night_one_end: 'timestamp',
      receiving_night_two_start: 'timestamp', receiving_night_two_end: 'timestamp'
    })
  }),
  archive: Object.freeze({
    type: RECORD_TYPES.ARCHIVE,
    required: Object.freeze(['archive_schema_version', 'projected_total', 'arrived_total', 'bus_data', 'dorm_data']),
    fields: Object.freeze({
      archive_schema_version: 'string', projected_total: 'integer', arrived_total: 'integer',
      arrived_air_force_total: 'integer', arrived_space_force_total: 'integer', naturalization_total: 'integer',
      female_total: 'integer', receiving_windows: 'object', bus_data: 'array', dorm_data: 'array', closed_at: 'timestamp|null'
    })
  }),
  audit: Object.freeze({
    type: RECORD_TYPES.AUDIT,
    required: Object.freeze(['action', 'entity_type', 'entity_id']),
    fields: Object.freeze({
      action: 'string', entity_type: 'string', entity_id: 'string', actor_role: 'string', occurred_at: 'timestamp', changes: 'object'
    })
  })
});

export function getSchema(type) {
  return SCHEMAS[String(type || '').toLowerCase()] || null;
}
