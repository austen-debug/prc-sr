# GATE Build 2 Documentation Index

Status: Build 2, Phase 1D implemented  
Runtime status: Build 1 remains active; no Build 2 runtime asset is loaded.

## Governing documents

1. [`BUILD_2_CHARTER.md`](./BUILD_2_CHARTER.md) — mission, architecture, migration, and definition of done.
2. [`PHASE_1_OPERATIONAL_TRUTH.md`](./PHASE_1_OPERATIONAL_TRUTH.md) — Phase 1 packages, gates, and exit criteria.
3. [`METRIC_PROVENANCE_REGISTRY.md`](./METRIC_PROVENANCE_REGISTRY.md) — operational definitions and calculation ownership.
4. [`DOMAIN_CALCULATION_CATALOG.md`](./DOMAIN_CALCULATION_CATALOG.md) — canonical selectors and report models.
5. [`RECORD_NORMALIZATION_CONTRACT.md`](./RECORD_NORMALIZATION_CONTRACT.md) — Build 1 compatibility boundary.
6. [`REPOSITORY_CONTRACTS.md`](./REPOSITORY_CONTRACTS.md) — typed repositories, persistence results, capabilities, and conflict boundary.
7. [`PHASE_1B_EXECUTION_REPORT.md`](./PHASE_1B_EXECUTION_REPORT.md) — domain implementation report.
8. [`PHASE_1C_EXECUTION_REPORT.md`](./PHASE_1C_EXECUTION_REPORT.md) — normalization implementation report.
9. [`PHASE_1D_EXECUTION_REPORT.md`](./PHASE_1D_EXECUTION_REPORT.md) — repository implementation report.
10. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md) — parity and data-integrity scenarios.

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
    ├── repository-result.mjs
    ├── records-client.mjs
    ├── index.mjs
    └── repositories/
        ├── base-repository.mjs
        ├── bus-repository.mjs
        ├── dorm-repository.mjs
        ├── archive-repository.mjs
        ├── config-repository.mjs
        └── index.mjs
```

All Build 2 modules remain inactive and absent from the active middleware manifest.

## Automated validation

```text
tests/build-2/domain/operational-truth.test.mjs
tests/build-2/data/record-normalization.test.mjs
tests/build-2/data/repositories.test.mjs
.github/workflows/build-2-domain-tests.yml
.github/workflows/build-2-data-tests.yml
```

```bash
node --test tests/build-2/domain/*.test.mjs
node --test tests/build-2/data/*.test.mjs
```

## Current execution position

```text
Phase 1A — Operational Truth Registry                 COMPLETE
Phase 1B — Canonical Domain Calculations              IMPLEMENTED / INACTIVE
Phase 1C — Record Normalization Boundary              IMPLEMENTED / INACTIVE
Phase 1D — Typed Repository Boundary                  IMPLEMENTED / INACTIVE
Phase 1E — Parity and Data Integrity Validation       NEXT
```

## Integration rule

No Build 2 source enters the active runtime until calculation parity, repository validation, server-side authorization, persistence capabilities, affected consumers, rollback, and legacy retirement are approved.
