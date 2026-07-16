# GATE Build 2 Documentation Index

Status: Foundation Alignment Gates A–F complete; Phase 3A Status Board shadow migration authorized  
Runtime status: Build 1 UI and feature workflows remain active; Build 2 feature, workflow, synchronization, offline, and application assets remain staged.

## Governing documents

1. [`PROGRAM_INTENT_BASELINE.md`](./PROGRAM_INTENT_BASELINE.md) — governing mission, data, architecture, role, critical-write, archive, synchronization, responsive, and migration-order baseline.
2. [`FOUNDATION_ALIGNMENT_GATE.md`](./FOUNDATION_ALIGNMENT_GATE.md) — completed Gates A–F scope and activation boundaries.
3. [`PROGRAM_TRACEABILITY_MATRIX.md`](./PROGRAM_TRACEABILITY_MATRIX.md) — requirement-to-source, test, runtime, and remaining route-evidence mapping.
4. [`FOUNDATION_REVALIDATION_MATRIX.md`](./FOUNDATION_REVALIDATION_MATRIX.md) — consolidated Gate F validation controls and decision classes.
5. [`CORRECTED_PHASE_1_EXIT_DECISION.md`](./CORRECTED_PHASE_1_EXIT_DECISION.md) — governing approved Phase 1 foundation exit decision.
6. [`DEPLOYMENT_PREREQUISITES.md`](./DEPLOYMENT_PREREQUISITES.md) — repository versus external-environment proof and production prerequisites.
7. [`STATUS_BOARD_SHADOW_MIGRATION_AUTHORIZATION.md`](./STATUS_BOARD_SHADOW_MIGRATION_AUTHORIZATION.md) — bounded Phase 3A authorization.
8. [`CANONICAL_ENTITY_CONTRACT.md`](./CANONICAL_ENTITY_CONTRACT.md) — canonical entity and provenance contract.
9. [`BACKEND_VERSIONING_AUDIT_CONTRACT.md`](./BACKEND_VERSIONING_AUDIT_CONTRACT.md) — server versioning and audit contract.
10. [`CRITICAL_WORKFLOW_ORCHESTRATION.md`](./CRITICAL_WORKFLOW_ORCHESTRATION.md) — Gate D workflow and recovery contract.
11. [`SYNCHRONIZATION_DEGRADED_OPERATION.md`](./SYNCHRONIZATION_DEGRADED_OPERATION.md) — Gate E invalidation, authoritative refetch, stale/offline, no-queue, and cache contract.
12. [`BUILD_2_CHARTER.md`](./BUILD_2_CHARTER.md)
13. [`PHASE_1_OPERATIONAL_TRUTH.md`](./PHASE_1_OPERATIONAL_TRUTH.md)
14. [`METRIC_PROVENANCE_REGISTRY.md`](./METRIC_PROVENANCE_REGISTRY.md)
15. [`DOMAIN_CALCULATION_CATALOG.md`](./DOMAIN_CALCULATION_CATALOG.md)
16. [`RECORD_NORMALIZATION_CONTRACT.md`](./RECORD_NORMALIZATION_CONTRACT.md)
17. [`REPOSITORY_CONTRACTS.md`](./REPOSITORY_CONTRACTS.md)
18. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md)
19. [`PHASE_2_CHARTER.md`](./PHASE_2_CHARTER.md)
20. [`GDL_FOUNDATIONS.md`](./GDL_FOUNDATIONS.md)
21. [`GDL_TOKEN_REGISTRY.md`](./GDL_TOKEN_REGISTRY.md)
22. [`COMPONENT_CONTRACTS.md`](./COMPONENT_CONTRACTS.md)
23. [`COMPONENT_WORKSHOP.md`](./COMPONENT_WORKSHOP.md)
24. [`APP_SHELL_CONTRACT.md`](./APP_SHELL_CONTRACT.md)
25. [`ROUTE_PERMISSION_REGISTRY.md`](./ROUTE_PERMISSION_REGISTRY.md)
26. [`FRONTEND_ARCHITECTURE_ADR.md`](./FRONTEND_ARCHITECTURE_ADR.md)
27. [`RESPONSIVE_COMPOSITION_CONTRACTS.md`](./RESPONSIVE_COMPOSITION_CONTRACTS.md)
28. [`RESPONSIVE_VALIDATION_MATRIX.md`](./RESPONSIVE_VALIDATION_MATRIX.md)
29. [`ACCESSIBILITY_FOUNDATION.md`](./ACCESSIBILITY_FOUNDATION.md)
30. [`ACCESSIBILITY_VALIDATION_MATRIX.md`](./ACCESSIBILITY_VALIDATION_MATRIX.md)
31. [`PHASE_1B_EXECUTION_REPORT.md`](./PHASE_1B_EXECUTION_REPORT.md)
32. [`PHASE_1C_EXECUTION_REPORT.md`](./PHASE_1C_EXECUTION_REPORT.md)
33. [`PHASE_1D_EXECUTION_REPORT.md`](./PHASE_1D_EXECUTION_REPORT.md)
34. [`PHASE_1E_EXECUTION_REPORT.md`](./PHASE_1E_EXECUTION_REPORT.md) — original-scope validation; exit language superseded.
35. [`PHASE_2A_EXECUTION_REPORT.md`](./PHASE_2A_EXECUTION_REPORT.md)
36. [`PHASE_2B_EXECUTION_REPORT.md`](./PHASE_2B_EXECUTION_REPORT.md)
37. [`PHASE_2C_EXECUTION_REPORT.md`](./PHASE_2C_EXECUTION_REPORT.md)
38. [`PHASE_2D_EXECUTION_REPORT.md`](./PHASE_2D_EXECUTION_REPORT.md)
39. [`PHASE_2E_EXECUTION_REPORT.md`](./PHASE_2E_EXECUTION_REPORT.md)
40. [`PHASE_2_EXIT_REPORT.md`](./PHASE_2_EXIT_REPORT.md)
41. [`GATE_A_EXECUTION_REPORT.md`](./GATE_A_EXECUTION_REPORT.md)
42. [`GATE_B_EXECUTION_REPORT.md`](./GATE_B_EXECUTION_REPORT.md)
43. [`GATE_C_EXECUTION_REPORT.md`](./GATE_C_EXECUTION_REPORT.md)
44. [`GATE_D_EXECUTION_REPORT.md`](./GATE_D_EXECUTION_REPORT.md)
45. [`GATE_E_EXECUTION_REPORT.md`](./GATE_E_EXECUTION_REPORT.md)
46. [`GATE_F_EXECUTION_REPORT.md`](./GATE_F_EXECUTION_REPORT.md) — completed consolidated revalidation and exit decision.

## Consolidated foundation source

```text
public/app/
├── domain/
├── data/
├── workflows/
├── synchronization/
├── offline/
├── design/
├── components/
├── shell/
├── responsive/
└── accessibility/

functions/api/
schema.sql
migrations/0002_gate_c_append_only_audit.sql
public/gate-build-2-sw.js
```

The Build 2 application, workflow, synchronization, and service-worker assets remain staged. Build 1 does not import or register them.

## Automated validation

```text
tests/build-2/foundation/consolidated-foundation.test.mjs
tests/build-2/server/*.test.mjs
tests/build-2/data/*.test.mjs
tests/build-2/domain/*.test.mjs
tests/build-2/parity/*.test.mjs
tests/build-2/workflows/*.test.mjs
tests/build-2/synchronization/*.test.mjs
tests/build-2/design/*.test.mjs
tests/build-2/components/*.test.mjs
tests/build-2/shell/*.test.mjs
tests/build-2/responsive/*.test.mjs
tests/build-2/accessibility/*.test.mjs
.github/workflows/build-2-gate-f-tests.yml
```

## Current execution position

```text
Phase 1A — Operational Truth Registry              COMPLETE
Phase 1B — Canonical Domain Core                   COMPLETE / STAGED
Phase 1C — Compatibility and Canonical Entity      COMPLETE / STAGED
Phase 1D — Repository, Versioning, Audit, Workflows COMPLETE / STAGED
Phase 1E — Consolidated Foundation Validation      COMPLETE / STAGED

Phase 2A–2E — Application Foundation               COMPLETE / STAGED

Foundation Alignment Gate A                        COMPLETE / STAGED
Foundation Alignment Gate B                        COMPLETE / STAGED
Foundation Alignment Gate C                        COMPLETE
Foundation Alignment Gate D                        COMPLETE / STAGED
Foundation Alignment Gate E                        COMPLETE / STAGED
Foundation Alignment Gate F                        COMPLETE

Phase 3A — Status Board Shadow Migration            AUTHORIZED / NEXT
Production Build 2 route activation                NOT AUTHORIZED
Build 2 production critical writes                 NOT AUTHORIZED
Approved first route                               STATUS BOARD
```

## Integration rule

Only a hidden, read-only Status Board shadow package is authorized. A visible Build 2 route still requires route-specific parity, authorization, persistence, deployment, synchronization/degraded-operation, responsive/accessibility, activation, rollback, monitoring, and Build 1 retirement evidence.
