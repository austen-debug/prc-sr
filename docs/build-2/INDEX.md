# GATE Build 2 Documentation Index

Status: Build 2, Phase 2D implemented; validation pending  
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
18. [`PHASE_2B_EXECUTION_REPORT.md`](./PHASE_2B_EXECUTION_REPORT.md) — Phase 2B implementation and validation closure.
19. [`APP_SHELL_CONTRACT.md`](./APP_SHELL_CONTRACT.md) — canonical shell state, events, navigation presentations, and host responsibilities.
20. [`ROUTE_PERMISSION_REGISTRY.md`](./ROUTE_PERMISSION_REGISTRY.md) — route labels, role access, defaults, and permission rules.
21. [`FRONTEND_ARCHITECTURE_ADR.md`](./FRONTEND_ARCHITECTURE_ADR.md) — standards-based ES module architecture decision.
22. [`PHASE_2C_EXECUTION_REPORT.md`](./PHASE_2C_EXECUTION_REPORT.md) — Phase 2C implementation and validation closure.
23. [`RESPONSIVE_COMPOSITION_CONTRACTS.md`](./RESPONSIVE_COMPOSITION_CONTRACTS.md) — six postures, capability inputs, safe-area rules, and ownership boundaries.
24. [`RESPONSIVE_VALIDATION_MATRIX.md`](./RESPONSIVE_VALIDATION_MATRIX.md) — posture fixtures, thresholds, capability cases, and container boundaries.
25. [`PHASE_2D_EXECUTION_REPORT.md`](./PHASE_2D_EXECUTION_REPORT.md) — Phase 2D implementation and validation boundary.

## Build 2 source

```text
public/app/
├── domain/
├── data/
├── design/
├── components/
├── workshop/
├── shell/
└── responsive/
    ├── posture-registry.mjs
    ├── composition-selector.mjs
    ├── container-registry.mjs
    ├── gate-responsive.css
    ├── index.mjs
    └── workshop/
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
tests/build-2/shell/unified-shell.test.mjs
tests/build-2/responsive/responsive-composition.test.mjs
.github/workflows/build-2-domain-tests.yml
.github/workflows/build-2-data-tests.yml
.github/workflows/build-2-phase-1-validation.yml
.github/workflows/build-2-design-tests.yml
.github/workflows/build-2-component-tests.yml
.github/workflows/build-2-shell-tests.yml
.github/workflows/build-2-responsive-tests.yml
```

## Current execution position

```text
Build 2 Phase 1 — Operational Truth and Data Foundation COMPLETE

Phase 2A — GDL Foundations                     COMPLETE / INACTIVE
Phase 2B — Component Workshop                  COMPLETE / INACTIVE
Phase 2C — Unified Application Shell           COMPLETE / INACTIVE
Phase 2D — Responsive Composition Contracts    IMPLEMENTED / VALIDATION PENDING
Phase 2E — Accessibility Foundation            NEXT AFTER 2D CLOSURE
```

## Integration rule

No Build 2 source enters the active runtime until calculation parity, repository validation, server-side authorization, persistence capabilities, affected consumers, rollback, and legacy retirement are approved. Phase 2 design, component, shell, and responsive assets remain inactive until accessibility and feature-migration gates are satisfied.
