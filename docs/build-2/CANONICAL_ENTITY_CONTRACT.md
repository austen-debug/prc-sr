# GATE Build 2 — Canonical Entity Contract

Status: Foundation Alignment Gate B  
Runtime status: staged; Build 1 remains operational

## Purpose

Define the only record shape consumed by Build 2 domain selectors after persistence data crosses the compatibility boundary.

## Entity envelope

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
  compatibility,
  raw
}
```

## Ownership

- `public/app/data/record-normalizer.mjs` translates Build 1 persisted records into canonical entities.
- `public/app/data/canonical-entity.mjs` creates, validates, freezes, and identifies canonical entities.
- `public/app/domain/*` consumes canonical entities and must not interpret Build 1 field aliases.
- `raw` is retained only for rollback and Build 1-compatible transport updates.
- `compatibility` records source, operational timezone, aliases used, and normalization warnings.

## Role provenance

Canonical roles are:

```text
instructor
airman
squadron
system
unknown
```

Legacy records without actor fields normalize to `unknown`; the system does not fabricate historical attribution.

Every new Build 2 create, update, or delete request requires a recognized `actorRole`. Repository transport adapters write:

```text
created_by_role
updated_by_role
```

Create requests set both fields. Update and delete requests set `updated_by_role`. Server authorization and append-only audit ownership remain Gate C requirements.

## Canonical payloads

### Bus

```text
busId
busType
destination
originatingDestination
status
total
female
naturalization
spaceForce
airForce
createdAt
departedAt
arrivedAt
confirmedArrival
active
```

### Dorm

```text
name
sdq
section
interSection
sex
band
spaceForce
capacity
load
state
phase
openedAt
closedAt
closedTimer
assignedStaff
auditoriumLocation
notes
receivingWindows
```

### Config

```text
key
value
```

Legacy key aliases such as `active_wg` normalize to the canonical `week_group` key before the domain layer.

### Archive

The archive payload contains canonical totals, receiving windows, normalized bus/dorm snapshots, and closeout schema metadata. Immutable archive orchestration remains Gate D.

## Direct domain handoff

`toCanonicalDomainRecord()` and `toCanonicalDomainRecords()` now validate and pass canonical entities through unchanged. They do not reconstruct Build 1-shaped records.

The required flow is:

```text
Build 1 persistence shape
        ↓
legacy compatibility normalizer
        ↓
canonical Build 2 entity
        ↓
domain selectors and summaries
```

The prohibited flow is:

```text
canonical entity
        ↓
reconstructed Build 1 record
        ↓
domain normalization
```

## Unknown record behavior

Unknown future record types remain opaque canonical entities with losslessly recoverable raw records. Typed domain selectors ignore them. This preserves forward compatibility without allowing unknown records to affect operational calculations.

## Gate B exit criteria

```text
PASS — domain selectors consume canonical entities directly
PASS — Build 1 aliases exist only in compatibility and transport modules
PASS — canonical records include createdByRole and updatedByRole
PASS — legacy records without provenance normalize to unknown
PASS — all new Build 2 writes require recognized actorRole
PASS — unknown record types remain recoverable
PASS — historical calculation parity remains exact
PASS — Build 1 runtime remains unchanged
```
