# GATE Build 2 — Phase 1
## Operational Truth and Data Foundation

Status: Initiated
Phase owner: Build 2 data and domain architecture
Runtime impact at initiation: None
Build 1 remains the operational baseline.

## Objective

Establish one authoritative definition, eligibility rule, calculation path, and validation fixture for every operational value before Build 2 changes the visible GATE experience.

Phase 1 resolves the difference between:

- persisted source records;
- operational eligibility;
- derived calculations;
- user-interface presentation;
- report output;
- archive snapshot values.

## Current-state findings

### Persistent backend

The current API stores generic JSON records in the `records` table and rehydrates `__backendId`. It preserves critical dorm close/reopen protections, but it does not currently provide record-version conflict detection or typed repository boundaries.

### Arrivals

- Airport buses are created with `status: active` and a departure timestamp.
- Airport buses become arrived only after explicit confirmation, which sets `status: arrived` and `arrived_at`.
- Local arrivals are created with `status: arrived` and `arrived_at` immediately.
- Status Board arrived totals already filter for `status: arrived`.

### Report inconsistency requiring Build 2 resolution

The current receiving-night summary filters buses by a fallback time helper that can choose `arrived_at`, `departed_at`, `created_at`, or `updated_at`. This permits an active/en-route airport bus to enter a receiving-night calculation before confirmed arrival.

Build 2 rule:

> A bus contributes to processed, arrived, female, naturalization, or Space Force receiving totals only when it is operationally eligible as a confirmed arrival.

### Projected totals

Current projected totals are derived from the sum of `dorm.max_load` for the active Week Group. Build 2 must preserve this definition unless an explicit future projection record replaces it.

### Receiving windows

Current receiving windows originate in the Input workflow, are retained locally for editing, and are copied into dorm and archive data. Build 2 must normalize window ownership so reporting does not depend on live DOM fields or a specific page controller.

## Phase 1 work packages

## 1A — Operational Truth Registry

Deliver:

- metric provenance registry;
- current owner and consumer map;
- eligibility rules;
- known divergence list;
- historical parity scenarios.

No runtime integration occurs in 1A.

## 1B — Canonical Domain Calculation Contract

Introduce pure, framework-neutral calculation contracts for:

- active Week Group filtering;
- confirmed arrivals;
- active/en-route buses;
- projected totals;
- Air Force and Space Force separation;
- female totals;
- naturalization totals;
- receiving-window assignment;
- receiving-night cumulative summaries;
- dorm load and capacity;
- archive operational snapshots.

Required properties:

- no DOM access;
- no global variable access;
- no network access;
- deterministic output;
- explicit invalid-data handling;
- fixture-testable inputs and outputs.

## 1C — Record Normalization Contract

Define normalized Build 2 views of current records without destructive migration.

Target normalized envelope:

```js
{
  id,
  type,
  schemaVersion,
  recordVersion,
  weekGroup,
  createdAt,
  updatedAt,
  payload
}
```

Build 1 records must remain readable. Missing version fields receive documented compatibility defaults.

## 1D — Repository Boundary

Define typed repository contracts:

- `GateBusRepository`;
- `GateDormRepository`;
- `GateArchiveRepository`;
- `GateConfigRepository`;
- future `GateAuditRepository`.

Repositories own persistence translation, record normalization, validation, version checks, API error translation, and synchronization events.

Build 2 components and feature modules may not write generic records directly.

## 1E — Parity and Data Integrity Validation

Validate canonical selectors against:

- the known 911 projected / 818 Night One / 39 Night Two / 857 cumulative scenario;
- active bus exclusion;
- local arrival inclusion;
- no-Space-Force suppression;
- Space Force separation;
- NAT cumulative totals;
- edited arrived bus counts;
- arrivals outside receiving windows;
- windows crossing midnight;
- malformed legacy timestamps;
- empty and partial Week Groups;
- archive snapshot parity.

## Canonical eligibility rules

### Week Group

A week-specific record is eligible only when its normalized `week_group` matches the requested Week Group.

### Confirmed arrival

A bus is a confirmed arrival when:

```text
normalized status equals "arrived"
and
arrived_at is a valid timestamp
```

Compatibility handling for legacy arrived records without `arrived_at` must be explicit, separately tested, and must never cause an active/en-route record to count as arrived.

### Active bus

A bus is active/en route when its normalized status is `active` or `otw` and it has not been confirmed arrived.

### Air Force count

```text
Air Force count = max(total bus count - valid Space Force count, 0)
```

Space Force count must be constrained to the total bus count.

### Projected total

```text
Projected total = sum of normalized dorm max_load for the Week Group
```

### Receiving-night assignment

A confirmed arrival belongs to one receiving night only when its confirmed arrival timestamp is within that night’s half-open interval:

```text
start <= arrived_at < end
```

Receiving windows must not overlap.

### Cumulative totals

Cumulative values are the ordered sum of eligible receiving-night values. They are not independently calculated from presentation text or dorm processing timestamps.

## Forward validation

Phase 1 design must support:

- record versioning;
- stale-write conflict detection;
- audit events;
- cross-tab invalidation;
- future responsive UI consumers;
- report and archive reuse;
- potential backend replacement without feature rewrites.

## Backward validation

Phase 1 must preserve:

- current record retrieval;
- airport dispatch;
- arrival confirmation;
- local arrivals;
- Status Board counts;
- Processing workflows;
- dorm close/reopen protections;
- Week Group initialization;
- archive creation and verification;
- historical archive readability;
- role-based access;
- no-PII boundary.

## Runtime integration gate

No Phase 1 domain module may become an active runtime owner until:

1. its inputs and outputs are documented;
2. historical fixtures pass;
3. Build 1 and Build 2 outputs are compared against the same record set;
4. affected consumers are listed;
5. rollback is defined;
6. the former calculation owner is scheduled for retirement.

## Phase 1 exit criteria

```text
PASS — every operational metric has documented provenance
PASS — shared calculations have one Build 2 contract
PASS — only confirmed arrivals count as processed
PASS — Current Summary and Archive Report consume identical receiving logic
PASS — AF, SF, female, and NAT totals use the same eligible bus set
PASS — historical fixtures produce exact expected outcomes
PASS — Build 1 records normalize without data loss
PASS — repository contracts are approved
PASS — future conflict handling is specified
PASS — no new UI or compatibility layer was introduced
PASS — documentation matches implementation
```
