# GATE Build 2 Documentation Index

Status: Build 2, Phase 2B implemented; validation pending  
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
10. [`PHASE_1E_EXECUTION_REPORT.md`](./PHASE_1E_EXECUTION_REPORT.md) — parity and data-integrity closure report.
11. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md) — parity and data-integrity scenarios.
12. [`PHASE_2_CHARTER.md`](./PHASE_2_CHARTER.md) — design language, component, shell, responsive, and accessibility workstreams.
13. [`GDL_FOUNDATIONS.md`](./GDL_FOUNDATIONS.md) — GATE Design Language principles and foundation contracts.
14. [`GDL_TOKEN_REGISTRY.md`](./GDL_TOKEN_REGISTRY.md) — semantic token names, scales, density modes, and versioning.
15. [`PHASE_2A_EXECUTION_REPORT.md`](./PHASE_2A_EXECUTION_REPORT.md) — Phase 2A implementation and validation boundary.
16. [`COMPONENT_CONTRACTS.md`](./COMPONENT_CONTRACTS.md) — canonical component ownership, inputs, states, events, accessibility, and responsiveness.
17. [`COMPONENT_WORKSHOP.md`](./COMPONENT_WORKSHOP.md) — inactive reference environment, fixtures, interactions, and tooling decision.
18. [`PHASE_2B_EXECUTION_REPORT.md`](./PHASE_2B_EXECUTION_REPORT.md) — Phase 2B implementation and validation boundary.

## Build 2 source

```text
public/app/
├── domain/
├── data/
├── design/
│   ├── index.mjs
│   ├── tokens/
│   └── themes/
├── components/
│   ├── contracts.mjs
│   ├── render-utils.mjs
│   ├── renderers-core.mjs
│   ├── renderers-operational.mjs
│   ├── gate-components.css
│   └── index.mjs
└── workshop/
    ├── index.html
    ├── workshop.css
    ├── workshop.mjs
    └── fixtures.mjs
```

All Build 2 modules remain inactive and absent from the active middleware manifest.

## Automated validation

```text
tests/build-2/domain/operational-truth.test.mjs
tests/build-2/data/record-normalization.test.mjs
tests/build-2/data/repositories.test.mjs
tests/build-2/parity/phase-1e-parity.test.mjs
tests/build-2/design/gdl-foundations.test.mjs
tests/build-2/components/component-workshop.test.mjs
.github/workflows/build-2-domain-tests.yml
.github/workflows/build-2-data-tests.yml
.github/workflows/build-2-phase-1-validation.yml
.github/workflows/build-2-design-tests.yml
.github/workflows/build-2-component-tests.yml
```

## Current execution position

```text
Build 2 Phase 1 — Operational Truth and Data Foundation COMPLETE

Phase 2A — GDL Foundations                     COMPLETE / INACTIVE
Phase 2B — Component Workshop                  IMPLEMENTED / VALIDATION PENDING
Phase 2C — Unified Application Shell           NEXT AFTER 2B CLOSURE
Phase 2D — Responsive Composition Contracts    NOT STARTED
Phase 2E — Accessibility Foundation            NOT STARTED
```

## Integration rule

No Build 2 source enters the active runtime until calculation parity, repository validation, server-side authorization, persistence capabilities, affected consumers, rollback, and legacy retirement are approved. Phase 2 design and component assets remain inactive until component, shell, responsive, accessibility, and feature-migration gates are satisfied.
