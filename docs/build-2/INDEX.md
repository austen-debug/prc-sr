# GATE Build 2 Documentation Index

Status: Phase 3A evidence review package complete; fixture harness implemented; live and manual evidence collection open  
Runtime status: Build 1 remains the visible operational application. One hidden, read-only Status Board shadow bridge is active; the fixture evidence harness is not loaded by middleware; all Build 2 feature routes and write workflows remain staged.

## Governing documents

1. [`PROGRAM_INTENT_BASELINE.md`](./PROGRAM_INTENT_BASELINE.md) — governing mission, data, architecture, role, critical-write, archive, synchronization, responsive, and migration-order baseline.
2. [`FOUNDATION_ALIGNMENT_GATE.md`](./FOUNDATION_ALIGNMENT_GATE.md) — completed Gates A–F scope and activation boundaries.
3. [`PROGRAM_TRACEABILITY_MATRIX.md`](./PROGRAM_TRACEABILITY_MATRIX.md) — requirement-to-source, test, runtime, and remaining route-evidence mapping.
4. [`FOUNDATION_REVALIDATION_MATRIX.md`](./FOUNDATION_REVALIDATION_MATRIX.md) — consolidated Gate F validation controls and decision classes.
5. [`CORRECTED_PHASE_1_EXIT_DECISION.md`](./CORRECTED_PHASE_1_EXIT_DECISION.md) — governing approved Phase 1 foundation exit decision.
6. [`DEPLOYMENT_PREREQUISITES.md`](./DEPLOYMENT_PREREQUISITES.md) — repository versus external-environment proof and production prerequisites.
7. [`STATUS_BOARD_SHADOW_MIGRATION_AUTHORIZATION.md`](./STATUS_BOARD_SHADOW_MIGRATION_AUTHORIZATION.md) — consumed Phase 3A authorization and remaining evidence gate.
8. [`STATUS_BOARD_SHADOW_CONTRACT.md`](./STATUS_BOARD_SHADOW_CONTRACT.md) — active bridge, canonical snapshot, comparison, evidence, and activation boundaries.
9. [`STATUS_BOARD_PARITY_MATRIX.md`](./STATUS_BOARD_PARITY_MATRIX.md) — route values, sources, comparison rules, and blockers.
10. [`STATUS_BOARD_EVIDENCE_REVIEW_CONTRACT.md`](./STATUS_BOARD_EVIDENCE_REVIEW_CONTRACT.md) — sustained parity, manual evidence, mismatch disposition, deployment evidence, and decision boundary.
11. [`STATUS_BOARD_MANUAL_EVIDENCE_MATRIX.md`](./STATUS_BOARD_MANUAL_EVIDENCE_MATRIX.md) — six-posture, accessibility, fullscreen, degraded-operation, and rollback checklist.
12. [`STATUS_BOARD_ROLLBACK_PLAN.md`](./STATUS_BOARD_ROLLBACK_PLAN.md) — immediate Build 1-only recovery procedure.
13. [`STATUS_BOARD_EVIDENCE_HARNESS.md`](./STATUS_BOARD_EVIDENCE_HARNESS.md) — fixture-only review surface, evidence capabilities, isolation, and limits.
14. [`CANONICAL_ENTITY_CONTRACT.md`](./CANONICAL_ENTITY_CONTRACT.md) — canonical entity and provenance contract.
15. [`BACKEND_VERSIONING_AUDIT_CONTRACT.md`](./BACKEND_VERSIONING_AUDIT_CONTRACT.md) — server versioning and audit contract.
16. [`CRITICAL_WORKFLOW_ORCHESTRATION.md`](./CRITICAL_WORKFLOW_ORCHESTRATION.md) — Gate D workflow and recovery contract.
17. [`SYNCHRONIZATION_DEGRADED_OPERATION.md`](./SYNCHRONIZATION_DEGRADED_OPERATION.md) — Gate E invalidation, authoritative refetch, stale/offline, no-queue, and cache contract.
18. [`BUILD_2_CHARTER.md`](./BUILD_2_CHARTER.md)
19. [`PHASE_1_OPERATIONAL_TRUTH.md`](./PHASE_1_OPERATIONAL_TRUTH.md)
20. [`METRIC_PROVENANCE_REGISTRY.md`](./METRIC_PROVENANCE_REGISTRY.md)
21. [`DOMAIN_CALCULATION_CATALOG.md`](./DOMAIN_CALCULATION_CATALOG.md)
22. [`RECORD_NORMALIZATION_CONTRACT.md`](./RECORD_NORMALIZATION_CONTRACT.md)
23. [`REPOSITORY_CONTRACTS.md`](./REPOSITORY_CONTRACTS.md)
24. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md)
25. [`PHASE_2_CHARTER.md`](./PHASE_2_CHARTER.md)
26. [`GDL_FOUNDATIONS.md`](./GDL_FOUNDATIONS.md)
27. [`GDL_TOKEN_REGISTRY.md`](./GDL_TOKEN_REGISTRY.md)
28. [`COMPONENT_CONTRACTS.md`](./COMPONENT_CONTRACTS.md)
29. [`COMPONENT_WORKSHOP.md`](./COMPONENT_WORKSHOP.md)
30. [`APP_SHELL_CONTRACT.md`](./APP_SHELL_CONTRACT.md)
31. [`ROUTE_PERMISSION_REGISTRY.md`](./ROUTE_PERMISSION_REGISTRY.md)
32. [`FRONTEND_ARCHITECTURE_ADR.md`](./FRONTEND_ARCHITECTURE_ADR.md)
33. [`RESPONSIVE_COMPOSITION_CONTRACTS.md`](./RESPONSIVE_COMPOSITION_CONTRACTS.md)
34. [`RESPONSIVE_VALIDATION_MATRIX.md`](./RESPONSIVE_VALIDATION_MATRIX.md)
35. [`ACCESSIBILITY_FOUNDATION.md`](./ACCESSIBILITY_FOUNDATION.md)
36. [`ACCESSIBILITY_VALIDATION_MATRIX.md`](./ACCESSIBILITY_VALIDATION_MATRIX.md)
37. [`PHASE_1B_EXECUTION_REPORT.md`](./PHASE_1B_EXECUTION_REPORT.md)
38. [`PHASE_1C_EXECUTION_REPORT.md`](./PHASE_1C_EXECUTION_REPORT.md)
39. [`PHASE_1D_EXECUTION_REPORT.md`](./PHASE_1D_EXECUTION_REPORT.md)
40. [`PHASE_1E_EXECUTION_REPORT.md`](./PHASE_1E_EXECUTION_REPORT.md) — original-scope validation; exit language superseded.
41. [`PHASE_2A_EXECUTION_REPORT.md`](./PHASE_2A_EXECUTION_REPORT.md)
42. [`PHASE_2B_EXECUTION_REPORT.md`](./PHASE_2B_EXECUTION_REPORT.md)
43. [`PHASE_2C_EXECUTION_REPORT.md`](./PHASE_2C_EXECUTION_REPORT.md)
44. [`PHASE_2D_EXECUTION_REPORT.md`](./PHASE_2D_EXECUTION_REPORT.md)
45. [`PHASE_2E_EXECUTION_REPORT.md`](./PHASE_2E_EXECUTION_REPORT.md)
46. [`PHASE_2_EXIT_REPORT.md`](./PHASE_2_EXIT_REPORT.md)
47. [`GATE_A_EXECUTION_REPORT.md`](./GATE_A_EXECUTION_REPORT.md)
48. [`GATE_B_EXECUTION_REPORT.md`](./GATE_B_EXECUTION_REPORT.md)
49. [`GATE_C_EXECUTION_REPORT.md`](./GATE_C_EXECUTION_REPORT.md)
50. [`GATE_D_EXECUTION_REPORT.md`](./GATE_D_EXECUTION_REPORT.md)
51. [`GATE_E_EXECUTION_REPORT.md`](./GATE_E_EXECUTION_REPORT.md)
52. [`GATE_F_EXECUTION_REPORT.md`](./GATE_F_EXECUTION_REPORT.md) — completed consolidated revalidation and exit decision.
53. [`PHASE_3A_EXECUTION_REPORT.md`](./PHASE_3A_EXECUTION_REPORT.md) — completed automated shadow implementation and evidence status.
54. [`PHASE_3A_EVIDENCE_REVIEW_REPORT.md`](./PHASE_3A_EVIDENCE_REVIEW_REPORT.md) — review package implementation and open evidence classes.
55. [`PHASE_3A_EVIDENCE_HARNESS_REPORT.md`](./PHASE_3A_EVIDENCE_HARNESS_REPORT.md) — fixture harness implementation, validation, and evidence limits.

## Phase 3A source

```text
public/app/status-board-shadow/
├── contracts.mjs
├── legacy-snapshot.mjs
├── canonical-snapshot.mjs
├── parity.mjs
├── evidence-ledger.mjs
├── route-contract.mjs
├── runner.mjs
├── sync-adapter.mjs
├── review-contract.mjs
├── manual-evidence.mjs
├── mismatch-disposition.mjs
├── deployment-evidence.mjs
├── rollback-contract.mjs
├── review-evaluator.mjs
├── review-harness/
│   ├── index.html
│   ├── fixtures.mjs
│   ├── review-harness.mjs
│   ├── review-harness-tokens.css
│   └── review-harness.css
└── index.mjs

public/js/gate-status-board-shadow-controller.js
```

The hidden bridge is loaded by middleware after the active Status Board and timer controllers. It observes Build 1 output and retains aggregate parity evidence in memory. The evidence harness is a separate fixture-only file surface and is not loaded by middleware or registered as a route.

## Automated validation

```text
tests/build-2/status-board-shadow/status-board-shadow.test.mjs
tests/build-2/status-board-shadow/status-board-evidence-review.test.mjs
tests/build-2/status-board-shadow/status-board-evidence-harness.test.mjs
tests/build-2/status-board-shadow/fixtures/B2-P3A-F001-route-readiness.json
.github/workflows/build-2-phase-3a-status-board-shadow.yml
.github/workflows/build-2-phase-3a-evidence-review.yml
.github/workflows/build-2-phase-3a-evidence-harness.yml
```

All Phase 3A workflows rerun the complete foundation and application regression suites.

## Current execution position

```text
Phase 1A–1E — Validated Foundation                 COMPLETE / STAGED
Phase 2A–2E — Application Foundation               COMPLETE / STAGED

Foundation Alignment Gate A                       COMPLETE / STAGED
Foundation Alignment Gate B                       COMPLETE / STAGED
Foundation Alignment Gate C                       COMPLETE
Foundation Alignment Gate D                       COMPLETE / STAGED
Foundation Alignment Gate E                       COMPLETE / STAGED
Foundation Alignment Gate F                       COMPLETE

Phase 3A — Status Board Shadow Migration           COMPLETE / SHADOW ACTIVE
Phase 3A Evidence Review                           PACKAGE COMPLETE / EVIDENCE COLLECTION OPEN
Phase 3A Evidence Harness                          IMPLEMENTED / VALIDATION PENDING
Phase 3B — Status Board Controlled Test Surface    NOT AUTHORIZED
Production Build 2 route activation               NOT AUTHORIZED
Build 2 production critical writes                NOT AUTHORIZED
Build 1 Status Board retirement                   NOT AUTHORIZED
Approved first route                              STATUS BOARD
```

## Integration rule

Phase 3A activates only the hidden, read-only shadow observer and evidence evaluator. The fixture harness remains outside active middleware and routing. A visible Build 2 Status Board still requires sustained live parity evidence, disposition and correction of every blocking mismatch, route-specific manual accessibility and six-posture validation, controlled-environment prerequisites, exercised rollback, monitoring, and an explicit governance decision.
