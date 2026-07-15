# GATE Build 2 Documentation Index

Status: Foundation Alignment Gate D complete; Gate E next  
Runtime status: Build 1 UI and feature workflows remain active; Gate C persistence protections are available; Build 2 workflow and application assets remain staged.

## Governing documents

1. [`PROGRAM_INTENT_BASELINE.md`](./PROGRAM_INTENT_BASELINE.md) — governing mission, data, architecture, role, critical-write, archive, responsive, and migration-order baseline.
2. [`FOUNDATION_ALIGNMENT_GATE.md`](./FOUNDATION_ALIGNMENT_GATE.md) — Gates A–F scope, production block, and closure criteria.
3. [`PROGRAM_TRACEABILITY_MATRIX.md`](./PROGRAM_TRACEABILITY_MATRIX.md) — requirement-to-source, test, runtime, and remaining-gate mapping.
4. [`CANONICAL_ENTITY_CONTRACT.md`](./CANONICAL_ENTITY_CONTRACT.md) — direct canonical entity, provenance, alias, rollback, and unknown-record contract.
5. [`BACKEND_VERSIONING_AUDIT_CONTRACT.md`](./BACKEND_VERSIONING_AUDIT_CONTRACT.md) — server versions, conditional writes, role provenance, Squadron projection, and append-only audit contract.
6. [`CRITICAL_WORKFLOW_ORCHESTRATION.md`](./CRITICAL_WORKFLOW_ORCHESTRATION.md) — Gate D operation IDs, verified workflows, partial states, recovery, closeout, and amendment contracts.
7. [`BUILD_2_CHARTER.md`](./BUILD_2_CHARTER.md) — mission, architecture, migration, and definition of done.
8. [`PHASE_1_OPERATIONAL_TRUTH.md`](./PHASE_1_OPERATIONAL_TRUTH.md) — Phase 1 packages, gates, and exit criteria.
9. [`METRIC_PROVENANCE_REGISTRY.md`](./METRIC_PROVENANCE_REGISTRY.md) — operational definitions and calculation ownership.
10. [`DOMAIN_CALCULATION_CATALOG.md`](./DOMAIN_CALCULATION_CATALOG.md) — canonical selectors and report models.
11. [`RECORD_NORMALIZATION_CONTRACT.md`](./RECORD_NORMALIZATION_CONTRACT.md) — Build 1 compatibility and direct canonical handoff boundary.
12. [`REPOSITORY_CONTRACTS.md`](./REPOSITORY_CONTRACTS.md) — typed repositories, versioning, audit, and authorization boundaries.
13. [`PHASE_1B_EXECUTION_REPORT.md`](./PHASE_1B_EXECUTION_REPORT.md)
14. [`PHASE_1C_EXECUTION_REPORT.md`](./PHASE_1C_EXECUTION_REPORT.md)
15. [`PHASE_1D_EXECUTION_REPORT.md`](./PHASE_1D_EXECUTION_REPORT.md)
16. [`PHASE_1E_EXECUTION_REPORT.md`](./PHASE_1E_EXECUTION_REPORT.md)
17. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md)
18. [`PHASE_2_CHARTER.md`](./PHASE_2_CHARTER.md)
19. [`GDL_FOUNDATIONS.md`](./GDL_FOUNDATIONS.md)
20. [`GDL_TOKEN_REGISTRY.md`](./GDL_TOKEN_REGISTRY.md)
21. [`COMPONENT_CONTRACTS.md`](./COMPONENT_CONTRACTS.md)
22. [`COMPONENT_WORKSHOP.md`](./COMPONENT_WORKSHOP.md)
23. [`APP_SHELL_CONTRACT.md`](./APP_SHELL_CONTRACT.md)
24. [`ROUTE_PERMISSION_REGISTRY.md`](./ROUTE_PERMISSION_REGISTRY.md)
25. [`FRONTEND_ARCHITECTURE_ADR.md`](./FRONTEND_ARCHITECTURE_ADR.md)
26. [`RESPONSIVE_COMPOSITION_CONTRACTS.md`](./RESPONSIVE_COMPOSITION_CONTRACTS.md)
27. [`RESPONSIVE_VALIDATION_MATRIX.md`](./RESPONSIVE_VALIDATION_MATRIX.md)
28. [`ACCESSIBILITY_FOUNDATION.md`](./ACCESSIBILITY_FOUNDATION.md)
29. [`ACCESSIBILITY_VALIDATION_MATRIX.md`](./ACCESSIBILITY_VALIDATION_MATRIX.md)
30. [`PHASE_2A_EXECUTION_REPORT.md`](./PHASE_2A_EXECUTION_REPORT.md)
31. [`PHASE_2B_EXECUTION_REPORT.md`](./PHASE_2B_EXECUTION_REPORT.md)
32. [`PHASE_2C_EXECUTION_REPORT.md`](./PHASE_2C_EXECUTION_REPORT.md)
33. [`PHASE_2D_EXECUTION_REPORT.md`](./PHASE_2D_EXECUTION_REPORT.md)
34. [`PHASE_2E_EXECUTION_REPORT.md`](./PHASE_2E_EXECUTION_REPORT.md)
35. [`PHASE_2_EXIT_REPORT.md`](./PHASE_2_EXIT_REPORT.md)
36. [`GATE_A_EXECUTION_REPORT.md`](./GATE_A_EXECUTION_REPORT.md)
37. [`GATE_B_EXECUTION_REPORT.md`](./GATE_B_EXECUTION_REPORT.md)
38. [`GATE_C_EXECUTION_REPORT.md`](./GATE_C_EXECUTION_REPORT.md)
39. [`GATE_D_EXECUTION_REPORT.md`](./GATE_D_EXECUTION_REPORT.md) — completed Gate D implementation and validation record.

## Gate D workflow source

```text
public/app/workflows/
├── workflow-result.mjs
├── workflow-helpers.mjs
├── arrival-workflows.mjs
├── dorm-workflows.mjs
├── initialize-week-group.mjs
├── archive-workflows.mjs
├── recovery-workflows.mjs
├── initialization-recovery.mjs
└── index.mjs
```

Extended staged data source:

```text
public/app/data/
├── record-normalizer.mjs
└── repositories/
    ├── archive-repository.mjs
    ├── audit-repository.mjs
    ├── config-repository.mjs
    ├── dorm-repository.mjs
    └── sound-event-repository.mjs
```

No workflow module is loaded by the active middleware manifest or called by a Build 1 feature controller.

## Automated validation

```text
tests/build-2/workflows/critical-workflows.test.mjs
tests/build-2/server/*.test.mjs
tests/build-2/data/*.test.mjs
tests/build-2/domain/*.test.mjs
tests/build-2/parity/*.test.mjs
tests/build-2/design/*.test.mjs
tests/build-2/components/*.test.mjs
tests/build-2/shell/*.test.mjs
tests/build-2/responsive/*.test.mjs
tests/build-2/accessibility/*.test.mjs
.github/workflows/build-2-gate-d-tests.yml
```

## Current execution position

```text
Phase 1A — Operational Truth Registry             COMPLETE
Phase 1B — Canonical Domain Core                  COMPLETE / STAGED
Phase 1C — Compatibility and Canonical Entity     COMPLETE / STAGED
Phase 1D — Repository, Versioning, Audit, Workflows COMPLETE / STAGED
Phase 1E — Parity Validation                      COMPLETE FOR IMPLEMENTED SCOPE

Phase 2A–2E — Application Foundation              COMPLETE / STAGED

Foundation Alignment Gate A                       COMPLETE / STAGED
Foundation Alignment Gate B                       COMPLETE / STAGED
Foundation Alignment Gate C                       COMPLETE
Foundation Alignment Gate D                       COMPLETE / STAGED
Foundation Alignment Gate E                       NEXT
Foundation Alignment Gate F                       NOT STARTED

Phase 3 — Feature Migration and Legacy Retirement BLOCKED UNTIL GATES A–F CLOSE
Approved first route                              STATUS BOARD
```

## Integration rule

No Build 2 feature route activates until Gates A–F close and a Status Board-specific migration gate approves parity, authorization, persistence, synchronization/degraded-operation behavior, responsive/accessibility evidence, activation, rollback, and corresponding Build 1 retirement.
