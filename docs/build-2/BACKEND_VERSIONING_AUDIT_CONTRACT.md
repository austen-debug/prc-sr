# GATE Build 2 — Backend Versioning and Audit Contract

Status: Foundation Alignment Gate C, amended by Packages 04–05  
Runtime boundary: shared records API for Instructor/Airman continuity; isolated Squadron read endpoint

## Purpose

This contract establishes server-owned concurrency protection, trusted role provenance, append-only operational audit records, and the current Squadron authorization boundary.

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

Current Instructor/Airman Build 1 controllers do not send `If-Match`. Their existing writes remain accepted so operational continuity is preserved. Those writes still increment `record_version`, allowing later Build 2 reads to detect that authoritative state changed.

Build 2 typed repositories require conflict detection by default. An explicit `requireConflictDetection: false` is reserved for documented compatibility work and may not be used by migrated critical workflows.

## Server role provenance

The server derives role from the signed `prc_sr_session` cookie. `AUTH_SECRET` is mandatory; there is no fallback signing secret. Request-body role fields are not authoritative.

On create, the records API sets:

```text
created_by_role
updated_by_role
```

On update, the records API preserves `created_by_role` and replaces `updated_by_role` with the current verified session role.

Recognized session roles are:

```text
instructor
airman
squadron
```

`system` remains a trusted server-side audit/provenance role, not an interactive login role.

Unknown or unverifiable roles cannot read or write the records API. Squadron sessions cannot access `/api/records` at all. They are routed to the dedicated read-only `/squadron/` document and may retrieve only the positive-allowlisted `/api/squadron-board` projection. Direct requests to operational APIs, archives, persistence actions, SAT arrivals, or mutation routes are denied by server middleware.

## Squadron read contract

The dedicated Squadron endpoint may expose only approved operational status fields required to render the board, including:

```text
active Week Group label
airport-arrived aggregate
expected aggregate
rolling airport-dispatch tempo
approved active-airport-bus identifier/count/time fields
approved dorm squadron/name/section/state/phase/load/designator fields
board generation timestamp
```

It must not send complete raw records and must not expose internal notes, assigned personnel, auditorium locations, archive payloads, configuration objects, audit payloads, or mutation metadata. The browser does not receive a broad record set and then hide fields client-side.

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

Gate C establishes storage and immutability. Later workflow orchestration decides which critical multi-step workflows require audit success before the workflow may report completion.

## Authorization boundary

- Instructor and Airman sessions retain authenticated `/api/records` access required for operational continuity.
- Squadron sessions do not receive the operational app shell and do not receive generic records access.
- Squadron access is limited to `GET /api/session`, `GET /api/squadron-board`, and `POST /api/logout`; other API paths or methods are denied.
- Request-body provenance is never trusted.
- Command-specific Instructor/Airman authorization remains the responsibility of the named workflow orchestration and route-specific guards.

## Failure behavior

- Missing `AUTH_SECRET`: authentication fails closed with service configuration error.
- Invalid or missing record identity: `400`.
- Unknown record: `404`.
- Stale expected version: `409`.
- Invalid `If-Match`: `400`.
- Unauthorized role or Squadron request outside its allowlist: `403` after the authentication gate.
- Audit mutation: `405`.
- Persistence failure: `500` without a false success response.

## Exit evidence

The current contract must prove:

```text
PASS — server assigns initial record version
PASS — successful writes increment one version
PASS — stale conditional update is rejected
PASS — stale conditional delete is rejected
PASS — compatible Instructor/Airman no-header writes remain accepted
PASS — server role overrides request-body provenance
PASS — missing AUTH_SECRET fails closed
PASS — Squadron generic records read/write is rejected
PASS — Squadron operational app-shell access is redirected before content delivery
PASS — Squadron endpoint exposes only its positive allowlist
PASS — Squadron direct mutation and non-board API requests are rejected
PASS — audit append normalizes canonically
PASS — audit update/delete fail at repository and API
PASS — D1 append-only triggers are present
PASS — historical calculation parity remains exact
PASS — Build 2 application foundation remains clean
```
