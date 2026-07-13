# GATE Build 2 Documentation Index

Status: Build 2, Phase 1 initiated
Runtime status: Build 1 remains active; no Build 2 runtime asset is loaded.

## Governing documents

1. [`BUILD_2_CHARTER.md`](./BUILD_2_CHARTER.md)
   - mission, architecture direction, migration method, engineering rules, and definition of done.

2. [`PHASE_1_OPERATIONAL_TRUTH.md`](./PHASE_1_OPERATIONAL_TRUTH.md)
   - Phase 1 work packages, eligibility rules, validation gates, and exit criteria.

3. [`METRIC_PROVENANCE_REGISTRY.md`](./METRIC_PROVENANCE_REGISTRY.md)
   - operational definitions, source records, current owners, known divergences, and target Build 2 owners.

4. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md)
   - historical parity scenarios and required data-integrity assertions.

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
        ↓
Build 2, Phase 1B
Canonical Domain Calculation Contract
```

## Integration rule

Build 2 source code must not enter the active middleware/runtime stack until the relevant selector or repository contract passes fixtures, Build 1 parity comparison, consumer validation, and rollback review.
