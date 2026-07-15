# GATE Build 2 — Backend Versioning and Audit Contract

Status: Foundation Alignment Gate C  
Runtime boundary: shared records API, backward-compatible with Build 1 clients

## Purpose

This contract establishes server-owned concurrency protection, trusted role provenance, and append-only operational audit records before write-heavy Build 2 workflows migrate.

## Record-version contract

Every record returned by `/api/records` has a non-negative `record_version`.

- Historical records without a stored version read as version `0`.
- New records are created at version `1`.
- Every successful update increments the server version by exactly one.
- The server ignores client attempts to choose the resulting version.
- Successful create and update responses include an `ETag` containing the resulting version.

### Conditional writes

Build 2 sends the expected version through:

```http
If-Match: <record_version>
```

The server performs an atomic conditional update or delete against the version stored in the JSON record. A mismatch returns:

```text
HTTP 409
code: record_version_conflict
expectedRecordVersion
currentRecordVersion
```

The client maps HTTP `409` or `412` to repository error `conflict`.

### Build 1 compatibility

Current Build 1 controllers do not send `If-Match`. Their existing writes remain accepted so operational continuity is preserved. Those writes still increment `record_version`, allowing later Build 2 reads to detect that authoritative state changed.

Build 2 typed repositories require conflict detection by default. An explicit `requireConflictDetection: false` is reserved for documented compatibility work and may not be used by migrated critical workflows.

## Server role provenance

The records API derives role from the signed `prc_sr_session` cookie through a route-local server session bridge. Request-body role fields are not authoritative.

On create, the server sets:

```text
created_by_role
updated_by_role
```

On update, the server preserves `created_by_role` and replaces `updated_by_role` with the current verified session role.

Recognized server roles are:

```text
instructor
airman
squadron
system
```

Unknown or unverifiable roles cannot read or write the records API. Squadron is read-only and receives only limited bus, dorm, and safe configuration records with staff assignment, auditorium location, notes, archives, and audit events withheld.

Squadron login is not activated by Gate C.

## Audit-event contract

Canonical type:

```text
audit_event
```

Required transport fields:

```text
event_type
entity_type
entity_id
```

Canonical event fields:

```text
eventType
weekGroup
entityType
entityId
actorRole
occurredAt
priorVersion
resultingVersion
summary
metadata
```

The server overwrites `actor_role` from the verified session. Audit metadata may not contain trainee names, SSNs, DOD identifiers, EDIPI values, or orders fields.

## Append-only enforcement

Audit events are immutable through three controls:

1. `GateAuditRepository` exposes `append()` and rejects update/delete.
2. `/api/records` returns `405 append_only` for audit update/delete requests.
3. D1 triggers abort direct updates or deletes where `type = 'audit_event'`.

The migration is stored at:

```text
migrations/0002_gate_c_append_only_audit.sql
```

No existing record backfill is required. Unversioned records remain version `0` until their next successful write.

## Audit repository ownership

`GateAuditRepository.append()` validates:

- event type;
- entity type and identity;
- actor role;
- non-negative prior and resulting versions;
- resulting version not lower than prior version;
- prohibited metadata fields.

Gate C establishes storage and immutability. Gate D will decide which critical multi-step workflows require audit success before the workflow may report completion.

## Authorization boundary

- Instructor and Airman sessions retain the current authenticated records access required for Build 1 continuity.
- Squadron sessions are read-only and receive a reduced record projection.
- Request-body provenance is never trusted.
- Command-specific Instructor/Airman authorization remains the responsibility of the named workflow orchestration introduced in Gate D and route migration packages.

## Failure behavior

- Invalid or missing record identity: `400`.
- Unknown record: `404`.
- Stale expected version: `409`.
- Invalid `If-Match`: `400`.
- Unauthorized role: `403` after the global authentication gate.
- Audit mutation: `405`.
- Persistence failure: `500` without a false success response.

## Exit evidence

Gate C must prove:

```text
PASS — server assigns initial record version
PASS — successful writes increment one version
PASS — stale conditional update is rejected
PASS — stale conditional delete is rejected
PASS — Build 1 no-header writes remain compatible
PASS — server role overrides request-body provenance
PASS — Squadron write is rejected
PASS — Squadron read projection excludes restricted fields
PASS — audit append normalizes canonically
PASS — audit update/delete fail at repository and API
PASS — D1 append-only triggers are present
PASS — historical calculation parity remains exact
PASS — Build 2 application foundation remains clean
```
