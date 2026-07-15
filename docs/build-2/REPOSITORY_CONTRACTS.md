# GATE Build 2 — Repository Contracts

Status: Foundation Alignment Gate C implemented; validation pending  
Operational baseline: Build 1 remains active

## Purpose

The repository boundary prevents feature modules and components from using generic persistence records directly.

```text
Feature or workflow command
        ↓
Typed repository
        ↓
Records client
        ↓
Version-aware transport
        ↓
Server-authoritative records API
```

Repositories own command validation, compatibility translation, canonical return values, actor-role requirements, expected-version forwarding, and persistence error translation. They do not render UI or calculate shared operational metrics.

## Source structure

```text
public/app/data/
├── canonical-entity.mjs
├── provenance.mjs
├── record-normalizer.mjs
├── repository-result.mjs
├── records-client.mjs
├── index.mjs
└── repositories/
    ├── base-repository.mjs
    ├── bus-repository.mjs
    ├── dorm-repository.mjs
    ├── archive-repository.mjs
    ├── config-repository.mjs
    ├── audit-repository.mjs
    └── index.mjs
```

## Result contract

Every operation returns either:

```js
{ ok: true, data, error: null, meta }
```

or:

```js
{ ok: false, data: null, error: GateRepositoryError, meta }
```

Stable errors include validation, not found, conflict, unavailable conflict detection, unauthorized, forbidden, network, transport, persistence, and unsupported operation.

## Records API capabilities

```js
{
  recordVersioning: true,
  conditionalWrites: true,
  transactions: false,
  batchWrites: false,
  appendOnlyAudit: true,
  serverRoleProvenance: true
}
```

New records begin at version `1`. Historical records without a version normalize to `0`. Each successful update increments one version.

Build 2 updates and deletes send the current version through `If-Match`. A stale request returns HTTP `409` and maps to repository error `conflict`.

Build 1 requests without `If-Match` remain compatible and still advance the authoritative version.

## Base repository

`BaseRepository` owns typed listing, Week Group filtering, lookup, compatibility transport restoration, actor-role validation, expected-version forwarding, and warning propagation.

Conflict detection is enabled by default. An explicit `requireConflictDetection: false` is reserved for documented legacy compatibility and is prohibited for migrated critical workflows.

## Domain repositories

`GateBusRepository` owns airport dispatch, local arrival, arrival confirmation, and count correction.

`GateDormRepository` owns dorm creation, load update, open, close, reopen, and final-time correction.

`GateArchiveRepository` persists pre-calculated immutable snapshots. Closeout orchestration remains Gate D.

`GateConfigRepository` owns normalized config reads and writes and rejects credential-oriented keys.

## Audit repository

`GateAuditRepository` owns append-only operational events. It exposes listing, lookup, and `append()` while rejecting update and delete.

Events contain event identity, entity identity, verified actor role, occurrence time, prior/resulting versions, summary, and restricted operational metadata. Metadata may not include trainee-identifying or orders information.

Gate D will determine which critical workflows require successful audit persistence before reporting completion.

## Server authorization boundary

A route-local API middleware verifies the signed session cookie and supplies the verified role to the records function.

- Request-body role fields are not authoritative.
- Instructor and Airman access remain available for Build 1 continuity.
- Squadron is read-only and receives a reduced projection.
- Squadron login remains inactive.
- Command-specific Instructor/Airman restrictions move into named Gate D workflows.

## Append-only enforcement

Audit immutability is enforced through repository rejection, API `405 append_only` responses, and D1 update/delete triggers.

## Remaining limitations

```text
transactions: false
batchWrites: false
```

Week Group initialization, closeout, amendment, and other multi-record operations remain blocked pending Gate D orchestration and recovery behavior.

## Prohibited patterns

- UI components calling `/api/records` directly;
- migrated features constructing generic records independently;
- critical Build 2 writes without expected versions;
- trusting client-supplied role fields;
- audit-event update or deletion;
- credentials or trainee-identifying data in records or audit metadata;
- device-specific persistence paths.
