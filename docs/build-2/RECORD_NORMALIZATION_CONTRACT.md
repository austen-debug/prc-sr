# GATE Build 2 — Record Normalization Contract

Status: Build 2, Phase 1C
Runtime status: Inactive compatibility boundary; Build 1 remains authoritative.

## Purpose

This contract defines how persisted Build 1 JSON records are converted into stable Build 2 envelopes and canonical domain inputs without destructive migration, silent data loss, or runtime ownership changes.

The boundary exists between persistence and domain logic:

```text
Build 1 generic JSON records
        ↓
legacy compatibility and normalization
        ↓
Build 2 record envelopes
        ↓
canonical domain-record adapter
        ↓
Phase 1B selectors and calculations
```

## Canonical envelope

```js
{
  id,
  type,
  schemaVersion,
  recordVersion,
  weekGroup,
  createdAt,
  updatedAt,
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

### Envelope rules

- `id` normalizes `__backendId` or `id`.
- `type` is normalized to lowercase.
- `schemaVersion` preserves an existing schema value or receives a Build 1 legacy default.
- unversioned Build 1 records receive `recordVersion: 0`.
- `weekGroup` normalizes `week_group` or `weekGroup`.
- canonical timestamps are ISO-8601 UTC instants.
- `payload` is typed according to record type.
- `compatibility` records aliases and warnings rather than silently hiding repairs.
- `raw` preserves a JSON-safe copy of the original record for rollback and forensic comparison.

## Operational timezone

Build 1 receiving-window fields may contain browser `datetime-local` values with no timezone offset.

Phase 1C converts those values through an explicit operational timezone. The current compatibility default is:

```text
America/Chicago
```

This matches the PRC operating location and supports daylight-saving changes through the platform timezone database.

Rules:

1. timestamps with `Z` or a numeric offset are preserved as explicit instants;
2. offset-free `datetime-local` values are interpreted using the configured operational timezone;
3. nonexistent daylight-saving wall times are rejected with a warning;
4. ambiguous daylight-saving wall times resolve deterministically to the earliest matching instant and produce a warning;
5. domain calculations receive canonical UTC instants only.

The timezone must become repository/configuration context before runtime integration. UI components may not perform timezone conversion independently.

## Config compatibility

Canonical config aliases:

```text
active_wg
active-week-group
weekgroup
week_group
        ↓
week_group
```

```text
last-arrival
last_arrival
last_airport
        ↓
last_airport
```

Alias use is recorded in `compatibility.aliasesUsed`.

## Bus normalization

Canonical bus payload:

```js
{
  busId,
  busType,
  destination,
  originatingDestination,
  status,
  total,
  female,
  naturalization,
  spaceForce,
  airForce,
  createdAt,
  departedAt,
  arrivedAt,
  confirmedArrival,
  active
}
```

Rules:

- negative or non-finite counts normalize to zero;
- female, NAT, and Space Force counts cannot exceed the bus total;
- Air Force equals `max(total - spaceForce, 0)`;
- `active`, `otw`, and `en route` normalize to active;
- confirmed arrival requires both normalized `status === arrived` and a valid `arrivedAt`;
- an active record containing `arrived_at` remains ineligible until its status is arrived;
- an arrived record without valid `arrived_at` is flagged and excluded from confirmed-arrival calculations.

## Dorm normalization

Canonical dorm payload includes identity, organizational fields, flags, capacity, load, state, phase, timing, staff assignment, notes, and receiving windows.

Rules:

- capacity and load are finite non-negative integers;
- load is constrained to capacity and a warning is emitted when the source exceeds it;
- `space_force` and `is_space_force` normalize to one Boolean field;
- legacy `assigned_airman` maps to canonical `assignedStaff` without changing the stored Build 1 field;
- receiving-window fields are normalized through the operational timezone.

### Dorm operational identity

A dorm is uniquely identified within an Input initialization set by the composite pair:

```text
normalized Squadron/SDQ + normalized Dorm Name
```

Canonical key format:

```text
SQUADRON::DORM
```

Normalization trims surrounding whitespace, collapses repeated internal whitespace, and compares case-insensitively.

Required behavior:

- `324 + A04` and `326 + A04` are valid because the squadrons differ;
- `324 + A04` and `324 + A04` are duplicates and must be rejected;
- `324 + A04` and `324 + A05` are valid because the dorm names differ;
- Section and Inter Section are descriptive organizational fields and are not part of the current dorm uniqueness key.

Build 1 Input preflight and Build 2 domain/repository validation must enforce the same composite rule. A future identity-policy change requires an explicit migration decision and fixture updates.

The assignment field remains restricted to staff assignment. It must never become a trainee-name field.

## Archive normalization

Archive `bus_data` and `dorm_data` may be JSON strings or arrays. Invalid values produce warnings and empty arrays rather than exceptions.

Canonical archive Space Force truth uses this precedence:

1. explicit `arrived_space_force_total`;
2. Space Force total derived from confirmed-arrived archived buses;
3. legacy broad `space_force_total` only when archived bus arrival status is unavailable.

A disagreement between broad legacy `space_force_total` and confirmed-arrival truth is recorded as a warning.

Archive normalization does not mutate the historical record. It creates a canonical read model while preserving the original snapshot.

## Unknown record types

Unknown and future record types are preserved as opaque payloads. The compatibility boundary must not delete or reject records simply because Build 2 does not yet understand their schema.

## Round-trip and rollback

`restoreBuild1Record(envelope)` returns the preserved original JSON record.

This guarantees that Phase 1C can be removed without requiring a database rollback because:

- no persisted record is rewritten;
- no schema migration is executed;
- no active API path is changed;
- no Build 2 module is loaded by middleware.

## Domain adapter

`toCanonicalDomainRecord()` converts supported envelopes into the canonical record shape currently consumed by Phase 1B selectors.

The adapter exists to validate parity during migration. It is not a persistence writer and may not be used to bypass the future typed repository layer.

## Error and warning policy

Normalization is non-throwing for malformed persisted data whenever safe recovery is possible.

Warnings include:

- invalid timestamps;
- missing confirmed-arrival timestamps;
- ambiguous local times;
- constrained counts or loads;
- invalid archive JSON;
- archive total divergence;
- unknown record types;
- compatibility aliases.

Future repositories must surface material warnings to diagnostics and audit tooling. UI components should receive normalized entities, not raw warning-repair logic.

## Access-control boundary

The following Cloudflare environment bindings are reserved for future Squadron Board-only authentication:

```text
SQUADRON_USERNAME
SQUADRON_PASSWORD
```

Security rules:

- values remain server-side Cloudflare secrets;
- values are never embedded in JavaScript bundles, HTML, logs, documentation, or records;
- successful authentication will map to canonical role `squadron`;
- the Squadron role will be authorized only for Squadron Board routes and explicitly approved read APIs;
- hiding UI controls is not authorization;
- API and route enforcement must occur server-side;
- the existing `prc_sr_session` cookie name remains unchanged unless a separately approved session migration occurs.

Current Build 1 login code authenticates only MTI and Airman credentials. Phase 1C records the future Squadron boundary but does not activate or alter authentication.

## Integration gate

The compatibility boundary may enter runtime only after:

1. repository contracts are implemented;
2. operational timezone is supplied by server/config context;
3. Build 1 and Build 2 record-set parity is measured;
4. material warnings have an operational handling policy;
5. API authorization is reviewed for every role;
6. rollback is documented;
7. middleware integration is explicit and versioned.
