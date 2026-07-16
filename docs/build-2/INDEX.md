# GATE Build 2 Documentation Index

Status: Foundation Alignment Gate E complete; Gate F next  
Runtime status: Build 1 UI and feature workflows remain active; Build 2 workflows, synchronization, offline, and application assets remain staged.

## Governing documents

1. [`PROGRAM_INTENT_BASELINE.md`](./PROGRAM_INTENT_BASELINE.md) — governing mission, data, architecture, role, critical-write, archive, responsive, and migration-order baseline.
2. [`FOUNDATION_ALIGNMENT_GATE.md`](./FOUNDATION_ALIGNMENT_GATE.md) — Gates A–F scope, production block, and closure criteria.
3. [`PROGRAM_TRACEABILITY_MATRIX.md`](./PROGRAM_TRACEABILITY_MATRIX.md) — requirement-to-source, test, runtime, and remaining-gate mapping.
4. [`CANONICAL_ENTITY_CONTRACT.md`](./CANONICAL_ENTITY_CONTRACT.md) — canonical entity and provenance contract.
5. [`BACKEND_VERSIONING_AUDIT_CONTRACT.md`](./BACKEND_VERSIONING_AUDIT_CONTRACT.md) — server versioning and audit contract.
6. [`CRITICAL_WORKFLOW_ORCHESTRATION.md`](./CRITICAL_WORKFLOW_ORCHESTRATION.md) — Gate D workflow and recovery contract.
7. [`SYNCHRONIZATION_DEGRADED_OPERATION.md`](./SYNCHRONIZATION_DEGRADED_OPERATION.md) — Gate E invalidation, authoritative refetch, stale/offline, no-queue, and cache contract.
8. [`BUILD_2_CHARTER.md`](./BUILD_2_CHARTER.md)
9. [`PHASE_1_OPERATIONAL_TRUTH.md`](./PHASE_1_OPERATIONAL_TRUTH.md)
10. [`METRIC_PROVENANCE_REGISTRY.md`](./METRIC_PROVENANCE_REGISTRY.md)
11. [`DOMAIN_CALCULATION_CATALOG.md`](./DOMAIN_CALCULATION_CATALOG.md)
12. [`RECORD_NORMALIZATION_CONTRACT.md`](./RECORD_NORMALIZATION_CONTRACT.md)
13. [`REPOSITORY_CONTRACTS.md`](./REPOSITORY_CONTRACTS.md)
14. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md)
15. [`PHASE_2_CHARTER.md`](./PHASE_2_CHARTER.md)
16. [`GDL_FOUNDATIONS.md`](./GDL_FOUNDATIONS.md)
17. [`GDL_TOKEN_REGISTRY.md`](./GDL_TOKEN_REGISTRY.md)
18. [`COMPONENT_CONTRACTS.md`](./COMPONENT_CONTRACTS.md)
19. [`COMPONENT_WORKSHOP.md`](./COMPONENT_WORKSHOP.md)
20. [`APP_SHELL_CONTRACT.md`](./APP_SHELL_CONTRACT.md)
21. [`ROUTE_PERMISSION_REGISTRY.md`](./ROUTE_PERMISSION_REGISTRY.md)
22. [`FRONTEND_ARCHITECTURE_ADR.md`](./FRONTEND_ARCHITECTURE_ADR.md)
23. [`RESPONSIVE_COMPOSITION_CONTRACTS.md`](./RESPONSIVE_COMPOSITION_CONTRACTS.md)
24. [`RESPONSIVE_VALIDATION_MATRIX.md`](./RESPONSIVE_VALIDATION_MATRIX.md)
25. [`ACCESSIBILITY_FOUNDATION.md`](./ACCESSIBILITY_FOUNDATION.md)
26. [`ACCESSIBILITY_VALIDATION_MATRIX.md`](./ACCESSIBILITY_VALIDATION_MATRIX.md)
27. [`PHASE_1B_EXECUTION_REPORT.md`](./PHASE_1B_EXECUTION_REPORT.md)
28. [`PHASE_1C_EXECUTION_REPORT.md`](./PHASE_1C_EXECUTION_REPORT.md)
29. [`PHASE_1D_EXECUTION_REPORT.md`](./PHASE_1D_EXECUTION_REPORT.md)
30. [`PHASE_1E_EXECUTION_REPORT.md`](./PHASE_1E_EXECUTION_REPORT.md)
31. [`PHASE_2A_EXECUTION_REPORT.md`](./PHASE_2A_EXECUTION_REPORT.md)
32. [`PHASE_2B_EXECUTION_REPORT.md`](./PHASE_2B_EXECUTION_REPORT.md)
33. [`PHASE_2C_EXECUTION_REPORT.md`](./PHASE_2C_EXECUTION_REPORT.md)
34. [`PHASE_2D_EXECUTION_REPORT.md`](./PHASE_2D_EXECUTION_REPORT.md)
35. [`PHASE_2E_EXECUTION_REPORT.md`](./PHASE_2E_EXECUTION_REPORT.md)
36. [`PHASE_2_EXIT_REPORT.md`](./PHASE_2_EXIT_REPORT.md)
37. [`GATE_A_EXECUTION_REPORT.md`](./GATE_A_EXECUTION_REPORT.md)
38. [`GATE_B_EXECUTION_REPORT.md`](./GATE_B_EXECUTION_REPORT.md)
39. [`GATE_C_EXECUTION_REPORT.md`](./GATE_C_EXECUTION_REPORT.md)
40. [`GATE_D_EXECUTION_REPORT.md`](./GATE_D_EXECUTION_REPORT.md)
41. [`GATE_E_EXECUTION_REPORT.md`](./GATE_E_EXECUTION_REPORT.md) — completed Gate E implementation and validation record.

## Gate E source

```text
public/app/synchronization/
├── sync-state.mjs
├── authoritative-store.mjs
├── invalidation-channel.mjs
├── guarded-records-client.mjs
├── sync-coordinator.mjs
├── shell-bridge.mjs
└── index.mjs

public/app/offline/
├── cache-policy.mjs
├── service-worker-registration.mjs
└── index.mjs

public/gate-build-2-sw.js
```

The synchronization snapshot is in memory only. The staged service worker caches an explicit static-shell allowlist and treats `/api/*` as network-only.

## Automated validation

```text
tests/build-2/synchronization/synchronization-degraded-operation.test.mjs
tests/build-2/workflows/*.test.mjs
tests/build-2/server/*.test.mjs
tests/build-2/data/*.test.mjs
tests/build-2/domain/*.test.mjs
tests/build-2/parity/*.test.mjs
tests/build-2/design/*.test.mjs
tests/build-2/components/*.test.mjs
tests/build-2/shell/*.test.mjs
tests/build-2/responsive/*.test.mjs
tests/build-2/accessibility/*.test.mjs
.github/workflows/build-2-gate-e-tests.yml
```

## Current execution position

```text
Phase 1A — Operational Truth Registry              COMPLETE
Phase 1B — Canonical Domain Core                   COMPLETE / STAGED
Phase 1C — Compatibility and Canonical Entity      COMPLETE / STAGED
Phase 1D — Repository, Versioning, Audit, Workflows COMPLETE / STAGED
Phase 1E — Parity Validation                       COMPLETE FOR IMPLEMENTED SCOPE

Phase 2A–2E — Application Foundation               COMPLETE / STAGED

Foundation Alignment Gate A                        COMPLETE / STAGED
Foundation Alignment Gate B                        COMPLETE / STAGED
Foundation Alignment Gate C                        COMPLETE
Foundation Alignment Gate D                        COMPLETE / STAGED
Foundation Alignment Gate E                        COMPLETE / STAGED
Foundation Alignment Gate F                        NEXT

Phase 3 — Feature Migration and Legacy Retirement  BLOCKED UNTIL GATES A–F CLOSE
Approved first route                               STATUS BOARD
```

## Integration rule

No Build 2 feature route activates until Gates A–F close and a Status Board-specific migration gate approves parity, authorization, persistence, synchronization/degraded-operation behavior, responsive/accessibility evidence, activation, rollback, and corresponding Build 1 retirement.
