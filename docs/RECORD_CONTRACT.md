# GATE Record Contract

Status: Phase Zero baseline
Scope: Documentation only. No runtime behavior changes.

## Purpose

This document defines the operational records that make GATE persistent, usable, and auditable. The records are the backbone of the receiving workflow. UI refactors must preserve these data contracts.

GATE remains a non-PII system. The app tracks status counts, dorm workflow, buses, timing, and archive state. It must not collect trainee names, SSNs, DOBs, travel documents, medical data, or other personal identifiers.

## Storage model

Current backend model:

- Records are stored in the `records` table.
- Each row has an `id`, `type`, `week_group`, `data`, `created_at`, and `updated_at`.
- `data` is JSON.
- Backend rehydrates records by parsing JSON and adding `__backendId`.

Required persistence behavior:

- Every live operational record must have `type`.
- Every week-specific operational record must have `week_group`.
- Every backend-persisted record must have `__backendId` after creation/fetch.
- Updates must preserve record identity.
- Archive closeout must verify archive creation before deleting live records.

## Record types

Current known record types:

1. `config`
2. `dorm`
3. `bus`
4. `archive`
5. `sound_event`

Potential future record types:

1. `audit_event`
2. `system_setting`
3. `ui_preference`

## ConfigRecord

Purpose:

Stores system configuration values that are not operational entities.

Known examples:

- `active_wg`
- `last_airport`

Contract:

```js
{
  type: 'config',
  key: 'active_wg' | 'last_airport' | string,
  value: string,
  updated_at?: string,
  __backendId?: string
}
```

Workflow ownership:

- Active week group drives filtering for dorms, buses, processing, board, and archive.
- Last airport time drives Status Board metrics and airport display.

Enterprise rule:

- Config records should move to a dedicated configuration service.
- UI should not hand-edit config records directly.

## DormRecord

Purpose:

Represents one receiving dorm / processing location for a week group.

Contract:

```js
{
  type: 'dorm',
  week_group: string,
  dorm_name: string,
  sdq: string,
  section: string,
  inter_sec: string,
  sex: 'male' | 'female' | string,
  band: 'true' | 'false' | boolean,
  space_force?: 'true' | 'false' | boolean,
  is_space_force?: 'true' | 'false' | boolean,
  max_load: number,
  current_load: number,
  state: 'empty' | 'open' | 'closed',
  phase: string,
  opened_at: string,
  closed_at: string,
  closed_timer: string,
  assigned_airman?: string,
  auditorium_location?: string,
  notes?: string,
  receiving_window_start?: string,
  receiving_window_end?: string,
  manual_closed_timer_override?: boolean | 'true' | 'false',
  manual_reopen_override?: boolean | 'true' | 'false',
  overtime_sound_sent?: 'true' | 'false' | boolean,
  overtime_sound_at?: string,
  __backendId?: string
}
```

Important backend behavior:

- Once a dorm is closed, the backend preserves `state: closed`, `phase: Closed`, `opened_at`, `closed_at`, and `closed_timer` unless a valid manual override is sent.
- A closed dorm can only reopen if `manual_reopen_override` is sent.
- A closed timer can only be changed intentionally if `manual_closed_timer_override` is sent with a valid timer.

Workflow ownership:

- Input creates dorm records.
- Status Board displays dorm records.
- Processing opens/updates/closes dorm records.
- Squadron Board displays limited dorm records.
- Archive stores dorm snapshots.

Enterprise rules:

- Dorm close timing must never be overwritten by stale modals or old devices.
- Airman-accessible updates must not change instructor-only fields.
- Manual final-time correction must be explicit and auditable.

## BusRecord

Purpose:

Represents an airport bus or local arrival batch.

Contract:

```js
{
  type: 'bus',
  week_group: string,
  bus_id?: string,
  bus_type?: 'airport' | 'local' | string,
  destination?: string,
  originating_destination?: string,
  status: 'otw' | 'arrived' | string,
  otw_count: number,
  female_count: number,
  nat_count: number,
  space_force_count?: number,
  created_at: string,
  departed_at?: string,
  arrived_at?: string,
  updated_at?: string,
  __backendId?: string
}
```

Workflow ownership:

- Airport creates airport bus records.
- Processing/Airman access may create local arrival records.
- Status Board active buses are derived from `status: otw`.
- Arrived totals are derived from `status: arrived` bus records.
- Archive stores bus snapshots.

Enterprise rules:

- Bus create must create exactly one record.
- Confirm arrival must change one bus from `otw` to `arrived`.
- Counts must preserve female, NAT, and Space Force fields.
- Local arrival records must update arrived totals immediately.

## ArchiveRecord

Purpose:

Stores a verified operational closeout snapshot for historical use.

Contract:

```js
{
  type: 'archive',
  week_group: string,
  archived_at: string,
  archive_schema_version: string,
  closeout_safety_version: string,
  total_expected: number,
  total_arrived: number,
  space_force_total?: number,
  arrived_space_force_total?: number,
  bus_data: Array<BusRecord>,
  dorm_data: Array<DormRecord>,
  receiving_windows?: object,
  notes?: string,
  __backendId?: string
}
```

Workflow ownership:

- Archive closeout creates archive record.
- Archive closeout verifies archive exists before clearing live records.
- Archives page searches/displays archive records.
- Print/PDF output uses archive records.

Enterprise rules:

- Archive create must be verified before live records are deleted.
- Archive record must preserve enough data to understand the operational day without live records.
- Archive edit must not corrupt stored schema.

## SoundEventRecord

Purpose:

Stores/coordinates sound event state for operational notification sounds.

Contract:

```js
{
  type: 'sound_event',
  week_group: string,
  event_type: 'dorm_open' | 'dorm_closed' | 'overtime' | string,
  dorm_id?: string,
  dorm_name?: string,
  final_time?: string,
  action?: string,
  created_at: string,
  processed_at?: string,
  __backendId?: string
}
```

Workflow ownership:

- Dorm open/close and overtime logic may create sound events.
- Sound controller decides whether/when to play event.

Enterprise rules:

- Overtime sound should trigger once per eligible dorm at or after 60:00.
- Sounds must not repeat randomly or because of stale render loops.

## Receiving window fields

Purpose:

Stores operational receiving start/end windows used by reports and archives.

Contract:

```js
{
  receiving_window_start?: string,
  receiving_window_end?: string,
  receiving_windows?: {
    primary?: { start?: string, end?: string },
    secondary?: { start?: string, end?: string }
  }
}
```

Enterprise rules:

- Receiving windows must persist from Input through Archive and Print.
- Start/end validation must be clear.
- Mobile/tablet layout must not truncate date/time controls.

## Field privacy rules

Allowed:

- counts
- dorm identifiers
- week group
- timing
- status
- assigned Airman initials or non-PII label if operationally required
- auditorium/location labels
- flags for female dorm, Band, Space Force, NAT counts

Not allowed:

- trainee names
- SSNs
- DOB
- medical information
- travel documents
- orders
- addresses
- phone numbers
- personally identifying trainee data

## Frontend update rule

Correct order:

1. Validate command.
2. Update record through record service.
3. Sync store/cache from backend response.
4. Re-render owned surface.
5. Trigger hooks/events for dependent surfaces.

Incorrect order:

1. Change UI.
2. Assume data updated.
3. Hope polling catches up.

## Phase Zero conclusion

The backend record persistence model is fundamentally useful and should be preserved. The frontend must be refactored around explicit record contracts and a centralized record service so pages stop patching `dataSdk` and mutating `allData` directly.
