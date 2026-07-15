# GATE Build 2 Documentation Index

Status: Foundation Alignment Gate B complete; Gate C next  
Runtime status: Build 1 remains active; Build 2 foundation assets are staged and not loaded by the operational runtime.

## Governing documents

1. [`PROGRAM_INTENT_BASELINE.md`](./PROGRAM_INTENT_BASELINE.md) — governing mission, data, architecture, role, critical-write, archive, responsive, and migration-order baseline.
2. [`FOUNDATION_ALIGNMENT_GATE.md`](./FOUNDATION_ALIGNMENT_GATE.md) — Gates A–F scope, production block, and closure criteria.
3. [`PROGRAM_TRACEABILITY_MATRIX.md`](./PROGRAM_TRACEABILITY_MATRIX.md) — requirement-to-source, test, runtime, and remaining-gate mapping.
4. [`CANONICAL_ENTITY_CONTRACT.md`](./CANONICAL_ENTITY_CONTRACT.md) — direct canonical entity, provenance, alias, rollback, and unknown-record contract.
5. [`BUILD_2_CHARTER.md`](./BUILD_2_CHARTER.md) — mission, architecture, migration, and definition of done.
6. [`PHASE_1_OPERATIONAL_TRUTH.md`](./PHASE_1_OPERATIONAL_TRUTH.md) — Phase 1 packages, gates, and exit criteria.
7. [`METRIC_PROVENANCE_REGISTRY.md`](./METRIC_PROVENANCE_REGISTRY.md) — operational definitions and calculation ownership.
8. [`DOMAIN_CALCULATION_CATALOG.md`](./DOMAIN_CALCULATION_CATALOG.md) — canonical selectors and report models.
9. [`RECORD_NORMALIZATION_CONTRACT.md`](./RECORD_NORMALIZATION_CONTRACT.md) — corrected Build 1 compatibility and direct canonical handoff boundary.
10. [`REPOSITORY_CONTRACTS.md`](./REPOSITORY_CONTRACTS.md) — typed repositories, persistence results, capabilities, and conflict boundary.
11. [`PHASE_1B_EXECUTION_REPORT.md`](./PHASE_1B_EXECUTION_REPORT.md) — initial domain-core implementation report.
12. [`PHASE_1C_EXECUTION_REPORT.md`](./PHASE_1C_EXECUTION_REPORT.md) — normalization implementation report.
13. [`PHASE_1D_EXECUTION_REPORT.md`](./PHASE_1D_EXECUTION_REPORT.md) — repository-core implementation report.
14. [`PHASE_1E_EXECUTION_REPORT.md`](./PHASE_1E_EXECUTION_REPORT.md) — parity validation for the implemented Phase 1 subset.
15. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md) — parity and data-integrity scenarios.
16. [`PHASE_2_CHARTER.md`](./PHASE_2_CHARTER.md) — design language, component, shell, responsive, and accessibility workstreams.
17. [`GDL_FOUNDATIONS.md`](./GDL_FOUNDATIONS.md) — GATE Design Language principles and foundation contracts.
18. [`GDL_TOKEN_REGISTRY.md`](./GDL_TOKEN_REGISTRY.md) — semantic token names, scales, density modes, and versioning.
19. [`PHASE_2A_EXECUTION_REPORT.md`](./PHASE_2A_EXECUTION_REPORT.md) — Phase 2A implementation and validation boundary.
20. [`COMPONENT_CONTRACTS.md`](./COMPONENT_CONTRACTS.md) — canonical component ownership, inputs, states, events, accessibility, and responsiveness.
21. [`COMPONENT_WORKSHOP.md`](./COMPONENT_WORKSHOP.md) — staged reference environment, fixtures, interactions, and tooling decision.
22. [`PHASE_2B_EXECUTION_REPORT.md`](./PHASE_2B_EXECUTION_REPORT.md) — Phase 2B implementation and validation closure.
23. [`APP_SHELL_CONTRACT.md`](./APP_SHELL_CONTRACT.md) — canonical shell state, events, navigation presentations, and host responsibilities.
24. [`ROUTE_PERMISSION_REGISTRY.md`](./ROUTE_PERMISSION_REGISTRY.md) — route labels, role access, defaults, and permission rules.
25. [`FRONTEND_ARCHITECTURE_ADR.md`](./FRONTEND_ARCHITECTURE_ADR.md) — standards-based ES module architecture decision.
26. [`PHASE_2C_EXECUTION_REPORT.md`](./PHASE_2C_EXECUTION_REPORT.md) — Phase 2C implementation and validation closure.
27. [`RESPONSIVE_COMPOSITION_CONTRACTS.md`](./RESPONSIVE_COMPOSITION_CONTRACTS.md) — six postures, capability inputs, safe-area rules, and ownership boundaries.
28. [`RESPONSIVE_VALIDATION_MATRIX.md`](./RESPONSIVE_VALIDATION_MATRIX.md) — posture fixtures, thresholds, capability cases, and container boundaries.
29. [`PHASE_2D_EXECUTION_REPORT.md`](./PHASE_2D_EXECUTION_REPORT.md) — Phase 2D implementation and validation closure.
30. [`ACCESSIBILITY_FOUNDATION.md`](./ACCESSIBILITY_FOUNDATION.md) — WCAG 2.2 AA contracts.
31. [`ACCESSIBILITY_VALIDATION_MATRIX.md`](./ACCESSIBILITY_VALIDATION_MATRIX.md) — automated and route-migration accessibility evidence requirements.
32. [`PHASE_2E_EXECUTION_REPORT.md`](./PHASE_2E_EXECUTION_REPORT.md) — Phase 2E implementation and validation closure.
33. [`PHASE_2_EXIT_REPORT.md`](./PHASE_2_EXIT_REPORT.md) — Phase 2 foundation closure; superseded by alignment gates for Phase 3 entry.
34. [`GATE_A_EXECUTION_REPORT.md`](./GATE_A_EXECUTION_REPORT.md) — completed Gate A record.
35. [`GATE_B_EXECUTION_REPORT.md`](./GATE_B_EXECUTION_REPORT.md) — completed Gate B record.

## Build 2 source

```text
public/app/
├── domain/
├── data/
│   ├── canonical-entity.mjs
│   ├── legacy-compatibility.mjs
│   ├── provenance.mjs
│   ├── record-normalizer.mjs
│   ├── records-client.mjs
│   └── repositories/
├── design/
├── components/
├── workshop/
├── shell/
├── responsive/
└── accessibility/
```

All Build 2 modules remain staged and absent from active middleware.

## Automated validation

```text
tests/build-2/data/canonical-entities.test.mjs
tests/build-2/data/record-normalization.test.mjs
tests/build-2/data/repositories.test.mjs
tests/build-2/domain/*.test.mjs
tests/build-2/parity/*.test.mjs
tests/build-2/design/*.test.mjs
tests/build-2/components/*.test.mjs
tests/build-2/shell/*.test.mjs
tests/build-2/responsive/*.test.mjs
tests/build-2/accessibility/*.test.mjs
.github/workflows/build-2-gate-b-tests.yml
```

## Current execution position

```text
Phase 1A — Operational Truth Registry             COMPLETE
Phase 1B — Canonical Domain Core                  COMPLETE / STAGED
Phase 1C — Compatibility and Canonical Entity     COMPLETE / STAGED
Phase 1D — Typed Repository Core                  CORE COMPLETE; GATE C REQUIRED
Phase 1E — Parity Validation                      COMPLETE FOR IMPLEMENTED SCOPE

Phase 2A–2E — Application Foundation              COMPLETE / STAGED

Foundation Alignment Gate A                       COMPLETE / STAGED
Foundation Alignment Gate B                       COMPLETE / STAGED
Foundation Alignment Gate C                       NEXT
Foundation Alignment Gates D–F                    NOT STARTED

Phase 3 — Feature Migration and Legacy Retirement BLOCKED UNTIL GATES A–F CLOSE
Approved first route                              STATUS BOARD
```

## Integration rule

No Build 2 source enters the operational runtime until Gates A–F close and a Status Board-specific migration gate approves parity, authorization, persistence, responsive/accessibility evidence, activation, rollback, and corresponding Build 1 retirement.
