# GATE Build 2 — Repository Contracts

Status: Phase 1D implemented — inactive in runtime  
Operational baseline: Build 1 remains active

## Purpose

The repository boundary prevents feature modules and future GATE Design Language components from reading and writing generic persistence records directly.

```text
Feature command
    ↓
Typed repository
    ↓
Records client
    ↓
Transport
    ↓
Persistent records API
```

Repositories own operational validation, Build 1 payload translation, normalized return values, persistence error translation, and future conflict requirements. They do not render UI or calculate shared operational metrics.

## Source structure

```text
public/app/data/
├── repository-result.mjs
├── records-client.mjs
├── index.mjs
└── repositories/
    ├── base-repository.mjs
    ├── bus-repository.mjs
    ├── dorm-repository.mjs
    ├── archive-repository.mjs
    ├── config-repository.mjs
    └── index.mjs
```

## Result contract

Every repository operation returns a result object rather than exposing transport-specific responses:

```js
{
  ok: true,
  data,
  error: null,
  meta
}
```

or:

```js
{
  ok: false,
  data: null,
  error: GateRepositoryError,
  meta
}
```

Stable error codes include:

- `validation_error`
- `not_found`
- `conflict`
- `conflict_detection_unavailable`
- `unauthorized`
- `forbidden`
- `network_error`
- `transport_error`
- `persistence_error`
- `unsupported_operation`

UI consumers may map these codes to presentation states, but may not infer operational success from HTTP status or exception text.

## Records client

`createRecordsClient()` owns:

- transport execution;
- transport-response normalization;
- persisted-record normalization through Phase 1C;
- network and persistence error translation;
- capability reporting;
- optional conditional-write requirements.

`createFetchRecordsTransport()` is the Build 1 HTTP adapter for `/api/records`.

### Current Build 1 capabilities

```js
{
  recordVersioning: false,
  conditionalWrites: false,
  transactions: false,
  batchWrites: false
}
```

These are explicit limitations, not assumed capabilities.

A command may set `requireConflictDetection: true`. When the active transport cannot enforce record versions, the operation returns `conflict_detection_unavailable` and does not write. This prevents future critical workflows from silently claiming stale-write protection before the backend provides it.

Conditional headers are emitted only by a transport that declares conditional-write support.

## Base repository

`BaseRepository` owns shared persistence behavior:

- type-specific listing;
- Week Group filtering;
- record lookup by backend identity;
- Build 1 raw-record restoration;
- typed create/update/delete handoff;
- compatibility-warning propagation;
- expected-record-version forwarding.

Domain repositories own commands. The base repository does not contain Airport, Processing, Archive, or configuration business rules.

## Bus repository

`GateBusRepository` owns:

- active-bus reads;
- confirmed-arrival reads;
- airport bus dispatch;
- local arrival creation;
- explicit arrival confirmation;
- count edits.

Rules:

- Week Group is required;
- airport bus number is required;
- local originating destination is required;
- total must be between 1 and 44;
- female, naturalization, and Space Force counts may not exceed total;
- airport dispatch creates `status: active`;
- local arrival creates `status: arrived` with `arrived_at`;
- arrival confirmation is an explicit state transition;
- count edits preserve arrival identity and timestamp.

## Dorm repository

`GateDormRepository` owns:

- dorm creation;
- load updates;
- open;
- close;
- reopen;
- final-time correction.

Rules:

- capacity must be between 1 and 60;
- Band and Space Force are mutually exclusive;
- load may not exceed capacity;
- a closed dorm uses the explicit reopen command;
- reopen sends `manual_reopen_override` for Build 1 backend compatibility;
- final-time correction applies only to a closed dorm;
- final time uses `MM:SS`;
- correction sends `manual_closed_timer_override`.

The backend remains the final protection layer for dorm state and close timing.

## Archive repository

`GateArchiveRepository` owns persistence of a pre-calculated archive snapshot.

It does not calculate operational totals. Phase 1B domain selectors and a future archive snapshot builder must supply:

- projected total;
- confirmed-arrived total;
- loaded total;
- female total;
- naturalization total;
- confirmed Space Force total;
- bus and dorm snapshots;
- receiving windows.

For Build 1 compatibility, the one canonical confirmed Space Force value is written to both:

```text
space_force_total
arrived_space_force_total
```

This avoids perpetuating the prior broad-versus-arrived divergence while legacy readers remain active.

Archive closeout still requires create, backend verification, and only then deletion of eligible live records. Phase 1D does not activate closeout integration.

## Config repository

`GateConfigRepository` owns normalized config-key reads and writes, including active Week Group aliases.

It rejects persistence of keys ending in credential-oriented terms such as:

- `username`
- `password`
- `secret`
- `token`
- `credential`

Cloudflare environment bindings—including future Squadron Board credentials—remain server-side secrets and may not enter config records, client bundles, logs, archives, or documentation values.

## Squadron access boundary

Future Squadron Board authentication may consume server-side bindings named:

```text
SQUADRON_USERNAME
SQUADRON_PASSWORD
```

Phase 1D does not activate them.

Required future contract:

1. authentication occurs only in a server-side function;
2. successful authentication maps to role `squadron`;
3. session data contains role and expiration, never the password;
4. the existing `prc_sr_session` cookie name remains unless a separately approved migration changes it;
5. authorization restricts the role to Squadron Board and approved read-only data;
6. API authorization is enforced server-side, not only through hidden navigation;
7. Squadron users cannot mutate bus, dorm, config, or archive records.

## Integration gate

The repository layer remains inactive until:

- record versioning and stale-write behavior are approved for critical writes;
- repository commands are compared against Build 1 workflows;
- server-side role authorization is defined;
- affected feature owners are identified;
- rollback is documented;
- integration tests cover API behavior;
- no feature continues direct generic-record writes after migration.

## Prohibited patterns

- UI components calling `/api/records` directly;
- feature controllers constructing generic records independently;
- reports writing records;
- credentials stored as config records;
- optimistic critical writes without rollback and conflict behavior;
- claiming conflict protection while the backend ignores record versions;
- separate mobile and desktop persistence paths.
