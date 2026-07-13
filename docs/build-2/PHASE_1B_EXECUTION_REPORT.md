# GATE Build 2 — Phase 1B Execution Report

Status: Implemented and inactive
Work package: Canonical Domain Calculation Contract
Runtime impact: None

## Objective

Create one pure, deterministic calculation layer for GATE operational truth before any Build 2 UI or repository integration.

## Implemented source

```text
public/app/domain/
├── normalization.mjs
├── operational-metrics.mjs
├── receiving.mjs
└── index.mjs
```

## Implemented calculations

- Week Group normalization and filtering;
- strict confirmed-arrival eligibility;
- active/en-route bus selection;
- manifested bus-log totals;
- confirmed total, Air Force, Space Force, female, and NAT totals;
- projected total, Air Force, and Space Force capacity;
- dorm load and assignment totals;
- receiving-window validation;
- half-open Night One/Night Two assignment;
- cumulative receiving totals;
- rendering-ready receiving report model;
- Space Force inclusion/suppression state.

## Critical defect prevention

The Build 2 selector does not use `departed_at`, `created_at`, `updated_at`, or dorm-processing timestamps to decide whether a trainee has been processed.

Confirmed arrival requires:

```text
status === arrived
and
valid arrived_at
```

This prevents the active bus represented in fixture `B2-P1-F001` from adding:

```text
20 trainees
2 NAT requests
5 Space Force trainees
```

to receiving-night or confirmed-arrival totals.

## Validation

Test file:

```text
tests/build-2/domain/operational-truth.test.mjs
```

Local execution result before repository integration:

```text
7 tests
7 passed
0 failed
```

Validated behaviors:

1. 911 projected capacity;
2. 818 Night One;
3. 39 Night Two;
4. 857 cumulative;
5. NAT 52 / 4 / 56;
6. active bus exclusion;
7. malformed arrived record exclusion;
8. half-open window boundaries;
9. AF/SF partitioning;
10. manifested versus arrived separation;
11. dorm assignment summary;
12. timezone-aware canonical windows.

## CI gate

Created:

```text
.github/workflows/build-2-domain-tests.yml
```

The workflow runs Node 22’s built-in test runner when Build 2 domain source, fixtures, tests, or the workflow itself changes.

No third-party test dependency was added.

## Forward validation

The domain API is independent of any UI framework and supports future:

- GATE Design Language components;
- repository adapters;
- immutable archive snapshots;
- cross-tab synchronization;
- record-version conflict handling;
- framework migration without rewriting operational calculations.

## Backward validation

Build 1 remains unchanged:

- no middleware asset added;
- no Build 1 controller replaced;
- no API behavior changed;
- no CSS changed;
- no record mutation changed;
- no report output changed yet.

## Integration hold

Phase 1B source may not become an active runtime owner until Phase 1C normalizes Build 1 records and receiving-window timestamps, and parity comparison is performed against the active Build 1 consumers.

## Next work package

Build 2, Phase 1C — Record Normalization and Compatibility Boundary.

Phase 1C must define how generic Build 1 records become stable Build 2 entities without destructive migration, including explicit timezone conversion for current `datetime-local` receiving-window fields.
