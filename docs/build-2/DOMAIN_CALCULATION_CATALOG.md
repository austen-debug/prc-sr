# GATE Build 2 — Domain Calculation Catalog

Status: Phase 1B implemented; inactive runtime contract
Source root: `public/app/domain/`
Test root: `tests/build-2/domain/`

## Purpose

The Build 2 domain layer is the canonical, framework-neutral calculation boundary for GATE operational truth.

It exists to ensure that Status Board, Processing, Squadron Board, Current Summary, Archive Report, and future leadership views consume the same definitions and eligibility rules.

The domain layer:

- does not read the DOM;
- does not access global browser variables;
- does not call the network;
- does not persist records;
- does not render UI;
- does not mutate source records;
- produces deterministic results from explicit inputs.

## Runtime status

These modules are not loaded by `functions/_middleware.js` and do not alter Build 1 behavior.

Runtime integration is prohibited until:

1. fixture tests pass;
2. Build 1 and Build 2 outputs are compared from the same records;
3. affected consumers are identified;
4. rollback is defined;
5. the former calculation owner has a retirement action.

## Module structure

```text
public/app/domain/
├── normalization.mjs
├── operational-metrics.mjs
├── receiving.mjs
└── index.mjs
```

This structure separates normalization, shared operational selectors, and receiving/report calculations without creating page-specific calculation modules.

# 1. Normalization contract

## `normalizeText(value)`

Returns a trimmed string. Null and undefined become an empty string.

## `normalizeWeekGroup(value)`

Returns the canonical uppercase Week Group identifier.

## `toNonNegativeNumber(value, options)`

Normalizes numeric count values.

Default behavior:

- non-finite values become `0`;
- negative values become `0`;
- values are converted to integers.

## `normalizeTimestamp(value)`

Returns a canonical ISO timestamp or `null`.

Phase 1B requires explicit UTC or numeric timezone offsets. Timezone-less `datetime-local` values are rejected because their interpretation changes across browsers, hosts, and CI environments.

Build 1 receiving-window values will be converted into canonical timezone-aware timestamps by the Phase 1C record-normalization boundary.

## `normalizeStatus(value)`

Canonical statuses:

```text
arrived → arrived
active / otw / en-route → active
other values → normalized source value or unknown
```

## `normalizeBusRecord(record)`

Produces a normalized immutable bus model:

```js
{
  id,
  weekGroup,
  busId,
  busType,
  status,
  total,
  female,
  naturalization,
  spaceForce,
  airForce,
  createdAt,
  departedAt,
  arrivedAt,
  isConfirmedArrival,
  isActive,
  raw
}
```

Eligibility rule:

```text
isConfirmedArrival = status === "arrived" AND arrivedAt is valid
```

Count rules:

```text
0 <= female <= total
0 <= naturalization <= total
0 <= spaceForce <= total
airForce = max(total - spaceForce, 0)
```

## `normalizeDormRecord(record)`

Produces a normalized immutable dorm model:

```js
{
  id,
  weekGroup,
  name,
  capacity,
  load,
  spaceForce,
  state,
  phase,
  openedAt,
  closedAt,
  closedTimer,
  raw
}
```

Load rule:

```text
0 <= load <= capacity
```

# 2. Operational selectors and totals

## `selectBuses(records, weekGroup)`

Returns normalized bus records matching the requested Week Group.

## `selectDorms(records, weekGroup)`

Returns normalized dorm records matching the requested Week Group.

## `selectConfirmedArrivals(records, weekGroup)`

Returns only buses meeting the strict confirmed-arrival contract.

It does not fall back to:

- departure time;
- creation time;
- update time;
- dorm-processing time.

## `selectActiveBuses(records, weekGroup)`

Returns active/en-route buses that have not become confirmed arrivals.

## `calculateBusTotals(buses)`

Calculates one partitioned total from one normalized bus set:

```js
{
  busCount,
  total,
  airForce,
  spaceForce,
  female,
  naturalization
}
```

This is the shared arithmetic used by confirmed-arrival totals and receiving-night totals.

## `calculateConfirmedArrivalTotals(records, weekGroup)`

Returns the canonical live arrived totals.

Intended consumers:

- Status Board;
- Processing assignment summary;
- Squadron Board;
- Current Summary;
- Archive Report;
- archive snapshot builder.

## `calculateManifestedBusTotals(records, weekGroup)`

Returns totals across all bus-log records regardless of arrival status.

This function is intentionally separate from confirmed arrivals. It supports the Airport log while preventing a manifested/logged total from being mislabeled as arrived.

## `calculateCapacityTotals(records, weekGroup)`

Returns:

```js
{
  dormCount,
  total,
  airForce,
  spaceForce
}
```

Build 1 compatibility definition:

```text
Projected total = sum of dorm capacity
```

## `calculateLoadTotals(records, weekGroup)`

Returns total assigned dorm load and total capacity.

## `calculateAssignmentSummary(records, weekGroup)`

Returns:

```js
{
  arrived,
  loaded,
  awaitingAssignment,
  overAssigned
}
```

Formulas:

```text
awaitingAssignment = max(arrived - loaded, 0)
overAssigned = max(loaded - arrived, 0)
```

# 3. Receiving-window contract

## `normalizeReceivingWindows(windows)`

Normalizes Night One and Night Two start/end fields into canonical timestamp windows.

## `validateReceivingWindows(windows)`

Validates:

- complete start/end pairs;
- timezone-aware timestamps;
- end after start;
- no overlap between configured windows.

## `isTimestampInWindow(timestamp, window)`

Uses a half-open interval:

```text
start <= arrivedAt < end
```

An arrival exactly at the Night Two start belongs to Night Two and cannot also belong to Night One.

## `calculateReceivingSummary(input)`

Input:

```js
{
  records,
  weekGroup,
  windows
}
```

Output contains:

- validated receiving windows;
- projected AF/SF/total capacity;
- confirmed AF/SF/female/NAT/total arrivals;
- Night One and Night Two totals;
- ordered cumulative totals;
- bus IDs assigned to each window;
- confirmed arrivals outside configured windows.

Only confirmed-arrival buses are considered for window assignment.

## `buildReceivingReportModel(summary)`

Transforms the canonical receiving summary into a rendering model without recalculating operational totals.

The standard sentence model uses Air Force values. Space Force remains a separate optional section:

```js
{
  standard: {
    processed,
    projected,
    cumulative
  },
  naturalization: {
    tonight,
    cumulative
  },
  spaceForce: null | {
    processed,
    projected,
    cumulative
  }
}
```

Space Force is omitted only when both projected and confirmed Space Force values are zero.

# 4. Validation coverage

The Phase 1B test suite currently verifies:

1. historical `911 / 818 / 39 / 857` parity;
2. NAT `52 / 4 / 56` parity;
3. active-bus exclusion;
4. arrived records without valid `arrived_at` exclusion;
5. half-open receiving-window boundaries;
6. Air Force and Space Force partitioning;
7. Space Force report suppression and inclusion;
8. manifested bus totals remaining distinct from confirmed arrivals;
9. Processing assignment calculations;
10. explicit timezone requirements.

Test command:

```bash
node --test tests/build-2/domain/*.test.mjs
```

CI workflow:

```text
.github/workflows/build-2-domain-tests.yml
```

The workflow uses Node 22 and no third-party test dependency.

# 5. Forward-validation impact

The contract is designed to support:

- Build 2 responsive components;
- a typed repository layer;
- record-version conflict checks;
- cross-tab invalidation;
- immutable archive snapshots;
- reusable report models;
- a future framework decision without rewriting business logic.

# 6. Backward-validation boundary

Phase 1B does not replace any Build 1 owner.

Before integration, each consumer must be compared against the same source dataset:

```text
Build 1 result
versus
Build 2 selector result
```

Known expected differences must be treated as defect corrections, not unexplained parity failures. The first expected correction is exclusion of active/en-route buses from receiving-night calculations.

# 7. Next work package

Build 2, Phase 1C will define the record-normalization and compatibility boundary that converts current generic Build 1 records into stable Build 2 entities, including deterministic conversion of existing receiving-window values into timezone-aware timestamps.
