# GATE Build 2 Documentation Index

Status: Build 2, Phase 1C implemented
Runtime status: Build 1 remains active; no Build 2 runtime asset is loaded.

## Governing documents

1. [`BUILD_2_CHARTER.md`](./BUILD_2_CHARTER.md)
   - mission, architecture direction, migration method, engineering rules, and definition of done.

2. [`PHASE_1_OPERATIONAL_TRUTH.md`](./PHASE_1_OPERATIONAL_TRUTH.md)
   - Phase 1 work packages, eligibility rules, validation gates, and exit criteria.

3. [`METRIC_PROVENANCE_REGISTRY.md`](./METRIC_PROVENANCE_REGISTRY.md)
   - operational definitions, source records, current owners, known divergences, and target Build 2 owners.

4. [`DOMAIN_CALCULATION_CATALOG.md`](./DOMAIN_CALCULATION_CATALOG.md)
   - canonical normalization, selectors, receiving calculations, report-model contracts, and validation coverage.

5. [`RECORD_NORMALIZATION_CONTRACT.md`](./RECORD_NORMALIZATION_CONTRACT.md)
   - Build 1 compatibility envelope, timezone conversion, aliases, archive normalization, rollback, and future access-control boundary.

6. [`PHASE_1B_EXECUTION_REPORT.md`](./PHASE_1B_EXECUTION_REPORT.md)
   - implemented domain source, test results, backward-validation boundary, and Phase 1C handoff.

7. [`PHASE_1C_EXECUTION_REPORT.md`](./PHASE_1C_EXECUTION_REPORT.md)
   - implemented data source, fixture results, access-control FYSA, rollback boundary, and Phase 1D handoff.

8. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md)
   - historical parity scenarios and required data-integrity assertions.

## Build 2 source

```text
public/app/
├── domain/
│   ├── normalization.mjs
│   ├── operational-metrics.mjs
│   ├── receiving.mjs
│   └── index.mjs
└── data/
    ├── legacy-compatibility.mjs
    ├── record-normalizer.mjs
    └── index.mjs
```

All modules are inactive ES modules and are not referenced by the active middleware manifest.

## Automated validation

```text
tests/build-2/domain/operational-truth.test.mjs
tests/build-2/data/record-normalization.test.mjs
.github/workflows/build-2-domain-tests.yml
.github/workflows/build-2-data-tests.yml
```

Test commands:

```bash
node --test tests/build-2/domain/*.test.mjs
node --test tests/build-2/data/*.test.mjs
```

## Machine-readable fixtures

- [`../../tests/build-2/fixtures/B2-P1-F001-receiving-parity.json`](../../tests/build-2/fixtures/B2-P1-F001-receiving-parity.json)
  - 911 projected;
  - 818 Night One;
  - 39 Night Two;
  - 857 cumulative;
  - NAT 52 / 4 / 56;
  - active-bus exclusion;
  - no-Space-Force suppression.

- [`../../tests/build-2/fixtures/B2-P1-F011-record-compatibility.json`](../../tests/build-2/fixtures/B2-P1-F011-record-compatibility.json)
  - Build 1 config aliases;
  - operational-timezone conversion;
  - active/arrived bus separation;
  - dorm load constraints;
  - archive Space Force reconciliation;
  - unknown-record preservation.

## Access-control planning note

Cloudflare bindings reserved for future Squadron Board-only authentication:

```text
SQUADRON_USERNAME
SQUADRON_PASSWORD
```

They are not currently consumed by Build 1 login code and remain outside Phase 1C runtime scope.

## Current execution position

```text
Build 2, Phase 1A
Operational Truth Registry and Historical Parity Baseline
COMPLETE

Build 2, Phase 1B
Canonical Domain Calculation Contract
IMPLEMENTED — NOT ACTIVE IN RUNTIME

Build 2, Phase 1C
Record Normalization and Compatibility Boundary
IMPLEMENTED — NOT ACTIVE IN RUNTIME

Build 2, Phase 1D
Typed Repository Boundary and Persistence Commands
NEXT
```

## Integration rule

Build 2 source code must not enter the active middleware/runtime stack until the relevant selector or repository contract passes fixtures, Build 1 parity comparison, consumer validation, authorization review, and rollback review.
