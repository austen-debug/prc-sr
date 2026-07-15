# GATE Build 2 — Foundation Alignment Gate

Status: ACTIVE PROGRAM CORRECTION  
Runtime status: staged; Build 1 remains the operational baseline

## Purpose

The alignment gate closes requirements that were documented in the original transformation program but were not fully implemented before Phase 1 was labeled complete. It preserves the validated Phase 2 foundation and prevents unresolved concurrency, audit, archive, synchronization, and domain-ownership gaps from entering Phase 3.

## Gate sequence

### Gate A — Program baseline and canonical domain completion

- establish one governing program-intent baseline;
- create requirement-to-source/test/runtime traceability;
- correct phase status language;
- complete active Week Group, arrival, bus, dorm, processing, timer, shared summary, report, and archive-snapshot domain owners;
- preserve the approved Status Board-first migration order;
- keep all work staged outside Build 1.

### Gate B — Canonical entities and role provenance

- remove the canonical-to-legacy-to-domain round trip;
- make domain selectors consume canonical entities directly;
- add `createdByRole` and `updatedByRole` to new Build 2 writes;
- isolate legacy aliases to normalization and transport adapters;
- retain non-destructive unknown-record and rollback behavior.

### Gate C — Backend versioning and append-only audit

- add server-enforced record versions and expected-version writes;
- return stable conflict responses;
- add `GateAuditRepository` and append-only audit-event records;
- require audit success for designated critical workflows;
- preserve server-side role authorization.

### Gate D — Critical workflow orchestration

- Week Group initialization with verification and recovery;
- bus confirmation and correction orchestration;
- dorm open/close/reopen/final-time orchestration;
- archive create/verify/audit/clear/verify closeout;
- immutable archive amendment behavior;
- explicit partial-failure states and rollback.

### Gate E — Synchronization and degraded operation

- `BroadcastChannel` invalidation notices followed by authoritative refetch;
- no second client-side database;
- visible offline, stale, and last-synchronized states;
- cached shell/static assets only;
- no queued critical writes until reconciliation is mature.

### Gate F — Consolidated revalidation

- full operational-truth and canonical-entity suites;
- deployed API version/conflict tests;
- audit and orchestration failure/recovery tests;
- archive transaction tests;
- synchronization and degraded-operation tests;
- complete Phase 2 regression;
- Build 1 isolation;
- corrected Phase 1 exit decision.

## Phase 3 block

No Build 2 production route may activate until Gates A–F close. Controlled workshops, hidden parity calculations, and non-runtime test fixtures remain permitted.

## Gate A exit criteria

```text
PASS — governing baseline exists
PASS — traceability matrix exists
PASS — phase status reflects actual implementation
PASS — approved route order is explicit
PASS — active Week Group owner exists
PASS — last confirmed arrival and local-arrival owners exist
PASS — bus manifested/active/arrived meanings remain distinct
PASS — dorm state and processing summaries exist
PASS — timer/overtime state has one deterministic owner
PASS — Current Summary and Archive Report share one model
PASS — immutable archive snapshot builder exists
PASS — historical 911/818/39/857 fixture remains exact
PASS — all prior Build 2 suites pass
PASS — Build 1 middleware remains unchanged
```

## Non-goals for Gate A

Gate A does not:

- activate Build 2;
- modify the records API;
- implement server versioning;
- create audit records;
- change login/session behavior;
- change active Build 1 calculations or reports;
- alter the approved role model;
- introduce new UI or CSS into the operational runtime.
