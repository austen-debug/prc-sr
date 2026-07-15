# GATE Build 2 — Phase 1E Execution Report

## Parity and Data Integrity Validation

Status: IMPLEMENTED — CI VALIDATION PENDING
Runtime status: inactive; Build 1 remains operational and unchanged

## Objective

Validate the complete Phase 1 chain across operational definitions, canonical calculations, legacy normalization, typed repositories, report models, and archive read models before any Build 2 runtime integration.

## Validation matrix

Phase 1E adds executable coverage for:

- the 911 projected / 818 Night One / 39 Night Two / 857 cumulative historical scenario through the existing F001 fixture;
- active bus exclusion;
- local confirmed-arrival inclusion;
- no-Space-Force report suppression;
- Air Force and Space Force separation;
- NAT nightly and cumulative totals;
- edited arrived-bus counts without duplicate accumulation;
- confirmed arrivals outside configured windows;
- receiving windows crossing midnight;
- half-open receiving-window boundaries;
- malformed legacy timestamps;
- empty Week Groups;
- partial Week Groups;
- archive/live total parity;
- Build 1 reference selector and Build 2 selector comparison against the same record set.

## Added validation source

```text
tests/build-2/parity/phase-1e-parity.test.mjs
.github/workflows/build-2-phase-1-validation.yml
```

The Phase 1 workflow executes all three layers:

```bash
node --test tests/build-2/domain/*.test.mjs
node --test tests/build-2/data/*.test.mjs
node --test tests/build-2/parity/*.test.mjs
```

## Data-integrity assertions

1. Only `status: arrived` records with valid `arrived_at` values contribute to arrival, processing, female, NAT, or Space Force totals.
2. Active/en-route buses remain visible as active but do not enter confirmed-arrival totals.
3. Local arrivals use the same eligibility rule as airport arrivals.
4. Edited records contribute their current persisted values once; record identity prevents positional or duplicate accumulation.
5. Confirmed arrivals outside receiving windows remain confirmed but are listed as unassigned to a receiving night.
6. Receiving windows are half-open and may cross midnight.
7. Malformed timestamps produce compatibility warnings and cannot create confirmed arrival eligibility.
8. Empty and partial Week Groups produce deterministic zero or partial totals without exceptions.
9. Archive normalized totals match the canonical live summary when produced from the same record population.
10. Space Force report sections are hidden only when both projected and confirmed Space Force totals are zero.

## Runtime and rollback boundary

No Build 2 module is added to middleware. No Build 1 controller, API route, authentication behavior, record, or visible interface is modified. Rollback consists only of removing the inactive test and documentation files.

## Closure gate

Phase 1E and Build 2 Phase 1 close only after the pull-request workflow passes all domain, data, repository, and parity suites. After successful CI, the Build 2 index will be updated to mark Phase 1 complete and identify Phase 2 as the next program stage.
