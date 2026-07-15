# GATE Build 2 — Record Normalization Contract

Status: Phase 1C core, corrected by Foundation Alignment Gate B  
Runtime status: staged compatibility boundary; Build 1 remains authoritative

## Purpose

Convert persisted Build 1 JSON records into stable canonical Build 2 entities without destructive migration, silent data loss, or runtime ownership changes.

```text
Build 1 generic JSON records
        ↓
legacy compatibility and normalization
        ↓
canonical Build 2 entities
        ↓
Build 2 domain selectors and summaries
```

No canonical-to-legacy-to-domain adapter is permitted. Build 1-shaped reconstruction exists only for rollback and compatibility transport writes.

## Canonical envelope

```js
{
  contractVersion,
  id,
  type,
  schemaVersion,
  recordVersion,
  weekGroup,
  createdAt,
  updatedAt,
  createdByRole,
  updatedByRole,
  payload,
  compatibility: {
    source,
    operationalTimeZone,
    aliasesUsed,
    warnings
  },
  raw
}
```

Rules:

- `id` normalizes `__backendId` or `id`.
- `type` is lowercase.
- `schemaVersion` preserves an existing schema value or receives a legacy default.
- unversioned records receive `recordVersion: 0`.
- `weekGroup` normalizes at the compatibility boundary.
- timestamps are ISO-8601 UTC instants or `null`.
- `createdByRole` and `updatedByRole` are canonical roles.
- absent historical provenance becomes `unknown`; it is never fabricated.
- `payload` is typed according to record type.
- `raw` preserves a JSON-safe copy for rollback and Build 1-compatible transport updates.

## Operational timezone

Offset-free `datetime-local` values are interpreted through explicit operational timezone context. The compatibility default is `America/Chicago`.

- explicit offsets are preserved as instants;
- nonexistent daylight-saving wall times are rejected with warnings;
- ambiguous wall times resolve to the earliest matching instant and warn;
- domain modules receive canonical UTC instants only.

## Alias ownership

Build 1 aliases are legal only inside compatibility and transport modules.

Config aliases normalize before domain handoff:

```text
active_wg | active-week-group | weekgroup | week_group → week_group
last-arrival | last_arrival | last_airport             → last_airport
```

Domain modules consume only `entity.payload.key`, `entity.weekGroup`, and typed canonical payload fields.

## Typed payloads

Bus payloads contain normalized identity, status, counts, service partitions, and timestamps. Confirmed arrival requires `status === arrived` and valid `arrivedAt`.

Dorm payloads contain canonical identity, organizational fields, flags, capacity/load, state/phase, timestamps, staff assignment, location, notes, and receiving windows. Load is constrained to capacity with a warning.

Archive payloads normalize stringified or array bus/dorm snapshots. Invalid arrays warn and become empty arrays. Confirmed-arrival Space Force truth takes precedence over broad legacy totals.

Unknown record types remain opaque canonical entities and retain their complete raw source.

## Dorm operational identity

The canonical uniqueness key is:

```text
normalized SDQ + normalized dorm name
SDQ::DORM
```

Section and Inter Section remain descriptive fields. Staff assignment may not become a trainee-name field.

## Role provenance

Canonical roles are `instructor`, `airman`, `squadron`, `system`, and `unknown`.

New Build 2 repository writes require a recognized `actorRole`:

- create writes set `created_by_role` and `updated_by_role`;
- update and delete requests set `updated_by_role`;
- missing or invalid actor roles fail validation before transport execution.

Server authorization and append-only audit events remain Gate C responsibilities.

## Direct domain handoff

`toCanonicalDomainRecord()` and `toCanonicalDomainRecords()` now validate and return canonical entities unchanged. They no longer create records containing `week_group`, `otw_count`, `dorm_name`, or other Build 1 aliases.

`restoreBuild1Record()` remains available only for lossless rollback and compatibility updates.

## Warning policy

Normalization remains non-throwing where safe recovery is possible. Warnings cover invalid timestamps, absent arrival timestamps, ambiguous local times, constrained counts/loads, invalid archive arrays, total divergence, unknown types, and aliases.

## Security boundary

Squadron credentials remain server-side Cloudflare bindings. They are never embedded in records, client bundles, logs, fixtures, or documentation values. Successful authentication will map to canonical role `squadron`; server authorization remains mandatory.

## Runtime gate

This boundary remains staged until Gates C–F and the route-specific migration gate approve authorization, conflict behavior, audit, orchestration, synchronization, degraded operation, rollback, and retirement of the corresponding Build 1 owner.
