# GATE Build 2 Documentation Index

Status: Foundation Alignment Gate A complete; Gate B next  
Runtime status: Build 1 remains active; Build 2 foundation assets are staged and not loaded by the operational runtime.

## Governing documents

1. [`PROGRAM_INTENT_BASELINE.md`](./PROGRAM_INTENT_BASELINE.md) — governing mission, data, architecture, role, critical-write, archive, responsive, and migration-order baseline.
2. [`FOUNDATION_ALIGNMENT_GATE.md`](./FOUNDATION_ALIGNMENT_GATE.md) — Gates A–F scope, production block, and closure criteria.
3. [`PROGRAM_TRACEABILITY_MATRIX.md`](./PROGRAM_TRACEABILITY_MATRIX.md) — requirement-to-source, test, runtime, and remaining-gate mapping.
4. [`BUILD_2_CHARTER.md`](./BUILD_2_CHARTER.md) — mission, architecture, migration, and definition of done.
5. [`PHASE_1_OPERATIONAL_TRUTH.md`](./PHASE_1_OPERATIONAL_TRUTH.md) — Phase 1 packages, gates, and exit criteria.
6. [`METRIC_PROVENANCE_REGISTRY.md`](./METRIC_PROVENANCE_REGISTRY.md) — operational definitions and calculation ownership.
7. [`DOMAIN_CALCULATION_CATALOG.md`](./DOMAIN_CALCULATION_CATALOG.md) — canonical selectors and report models.
8. [`RECORD_NORMALIZATION_CONTRACT.md`](./RECORD_NORMALIZATION_CONTRACT.md) — Build 1 compatibility boundary.
9. [`REPOSITORY_CONTRACTS.md`](./REPOSITORY_CONTRACTS.md) — typed repositories, persistence results, capabilities, and conflict boundary.
10. [`PHASE_1B_EXECUTION_REPORT.md`](./PHASE_1B_EXECUTION_REPORT.md) — initial domain-core implementation report.
11. [`PHASE_1C_EXECUTION_REPORT.md`](./PHASE_1C_EXECUTION_REPORT.md) — normalization implementation report.
12. [`PHASE_1D_EXECUTION_REPORT.md`](./PHASE_1D_EXECUTION_REPORT.md) — repository-core implementation report.
13. [`PHASE_1E_EXECUTION_REPORT.md`](./PHASE_1E_EXECUTION_REPORT.md) — parity validation for the implemented Phase 1 subset.
14. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md) — parity and data-integrity scenarios.
15. [`PHASE_2_CHARTER.md`](./PHASE_2_CHARTER.md) — design language, component, shell, responsive, and accessibility workstreams.
16. [`GDL_FOUNDATIONS.md`](./GDL_FOUNDATIONS.md) — GATE Design Language principles and foundation contracts.
17. [`GDL_TOKEN_REGISTRY.md`](./GDL_TOKEN_REGISTRY.md) — semantic token names, scales, density modes, and versioning.
18. [`PHASE_2A_EXECUTION_REPORT.md`](./PHASE_2A_EXECUTION_REPORT.md) — Phase 2A implementation and validation boundary.
19. [`COMPONENT_CONTRACTS.md`](./COMPONENT_CONTRACTS.md) — canonical component ownership, inputs, states, events, accessibility, and responsiveness.
20. [`COMPONENT_WORKSHOP.md`](./COMPONENT_WORKSHOP.md) — staged reference environment, fixtures, interactions, and tooling decision.
21. [`PHASE_2B_EXECUTION_REPORT.md`](./PHASE_2B_EXECUTION_REPORT.md) — Phase 2B implementation and validation closure.
22. [`APP_SHELL_CONTRACT.md`](./APP_SHELL_CONTRACT.md) — canonical shell state, events, navigation presentations, and host responsibilities.
23. [`ROUTE_PERMISSION_REGISTRY.md`](./ROUTE_PERMISSION_REGISTRY.md) — route labels, role access, defaults, and permission rules.
24. [`FRONTEND_ARCHITECTURE_ADR.md`](./FRONTEND_ARCHITECTURE_ADR.md) — standards-based ES module architecture decision.
25. [`PHASE_2C_EXECUTION_REPORT.md`](./PHASE_2C_EXECUTION_REPORT.md) — Phase 2C implementation and validation closure.
26. [`RESPONSIVE_COMPOSITION_CONTRACTS.md`](./RESPONSIVE_COMPOSITION_CONTRACTS.md) — six postures, capability inputs, safe-area rules, and ownership boundaries.
27. [`RESPONSIVE_VALIDATION_MATRIX.md`](./RESPONSIVE_VALIDATION_MATRIX.md) — posture fixtures, thresholds, capability cases, and container boundaries.
28. [`PHASE_2D_EXECUTION_REPORT.md`](./PHASE_2D_EXECUTION_REPORT.md) — Phase 2D implementation and validation closure.
29. [`ACCESSIBILITY_FOUNDATION.md`](./ACCESSIBILITY_FOUNDATION.md) — WCAG 2.2 AA keyboard, focus, touch, overlay, announcement, contrast, motion, and reflow contracts.
30. [`ACCESSIBILITY_VALIDATION_MATRIX.md`](./ACCESSIBILITY_VALIDATION_MATRIX.md) — automated and route-migration accessibility evidence requirements.
31. [`PHASE_2E_EXECUTION_REPORT.md`](./PHASE_2E_EXECUTION_REPORT.md) — Phase 2E implementation and validation closure.
32. [`PHASE_2_EXIT_REPORT.md`](./PHASE_2_EXIT_REPORT.md) — Phase 2 foundation closure; superseded by the alignment gate for Phase 3 entry authorization.
33. [`GATE_A_EXECUTION_REPORT.md`](./GATE_A_EXECUTION_REPORT.md) — completed Gate A implementation and validation record.

## Build 2 source

```text
public/app/
├── domain/
│   ├── normalization.mjs
│   ├── operational-metrics.mjs
│   ├── receiving.mjs
│   ├── week-groups.mjs
│   ├── arrivals.mjs
│   ├── buses.mjs
│   ├── dorms.mjs
│   ├── processing.mjs
│   ├── timers.mjs
│   ├── reports.mjs
│   ├── archives.mjs
│   ├── summaries.mjs
│   └── index.mjs
├── data/
├── design/
├── components/
├── workshop/
├── shell/
├── responsive/
└── accessibility/
```

All Build 2 modules remain staged and absent from the active middleware manifest.

## Automated validation

```text
tests/build-2/domain/operational-truth.test.mjs
tests/build-2/domain/foundation-alignment-gate-a.test.mjs
tests/build-2/data/record-normalization.test.mjs
tests/build-2/data/repositories.test.mjs
tests/build-2/parity/phase-1e-parity.test.mjs
tests/build-2/design/gdl-foundations.test.mjs
tests/build-2/components/component-workshop.test.mjs
tests/build-2/shell/unified-shell.test.mjs
tests/build-2/responsive/responsive-composition.test.mjs
tests/build-2/accessibility/accessibility-foundation.test.mjs
.github/workflows/build-2-foundation-alignment-tests.yml
```

## Current execution position

```text
Phase 1A — Operational Truth Registry             COMPLETE
Phase 1B — Canonical Domain Core                  COMPLETE / STAGED
Phase 1C — Compatibility Boundary                 CORE COMPLETE; GATE B REQUIRED
Phase 1D — Typed Repository Core                  CORE COMPLETE; GATE C REQUIRED
Phase 1E — Parity Validation                      COMPLETE FOR IMPLEMENTED SCOPE

Phase 2A–2E — Application Foundation              COMPLETE / STAGED

Foundation Alignment Gate A                       COMPLETE / STAGED
Foundation Alignment Gate B                       NEXT
Foundation Alignment Gates C–F                    NOT STARTED

Phase 3 — Feature Migration and Legacy Retirement BLOCKED UNTIL GATES A–F CLOSE
Approved first route                              STATUS BOARD
```

## Integration rule

No Build 2 source enters the operational runtime until Gates A–F close and a Status Board-specific Phase 3 migration gate approves live calculation parity, timer ownership, repository and authorization boundaries, responsive and accessibility evidence, affected consumers, activation, rollback, and corresponding Build 1 retirement.
