# GATE Build 2 Documentation Index

Status: Build 2, Phase 1B implemented
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

5. [`PHASE_1B_EXECUTION_REPORT.md`](./PHASE_1B_EXECUTION_REPORT.md)
   - implemented source, test results, backward-validation boundary, and Phase 1C handoff.

6. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md)
   - historical parity scenarios and required data-integrity assertions.

## Build 2 domain source

```text
public/app/domain/
├── normalization.mjs
├── operational-metrics.mjs
├── receiving.mjs
└── index.mjs
```

The modules are pure ES modules. They are not referenced by the active middleware manifest.

## Automated validation

```text
tests/build-2/domain/operational-truth.test.mjs
.github/workflows/build-2-domain-tests.yml
```

Test command:

```bash
node --test tests/build-2/domain/*.test.mjs
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
NEXT
```

## Integration rule

Build 2 source code must not enter the active middleware/runtime stack until the relevant selector or repository contract passes fixtures, Build 1 parity comparison, consumer validation, and rollback review.
