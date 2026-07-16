# GATE Build 2 Documentation Index

Status: Phase 3A shadow active; evidence collection open; Audit Remediation Gate 1 implemented and awaiting validation  
Runtime status: Build 1 remains the visible operational application. One hidden, read-only Status Board shadow bridge is active. The fixture harness and all other Build 2 feature, evidence-retention, write, synchronization-owner, and service-worker assets remain outside active middleware and routing.

## Current governing set

1. [`PROGRAM_INTENT_BASELINE.md`](./PROGRAM_INTENT_BASELINE.md) — mission, data, architecture, role, workflow, responsive, migration-order, and bloat-control baseline.
2. [`PROGRAM_TRACEABILITY_MATRIX.md`](./PROGRAM_TRACEABILITY_MATRIX.md) — requirement-to-source, validation, runtime, and evidence mapping.
3. [`CORRECTED_PHASE_1_EXIT_DECISION.md`](./CORRECTED_PHASE_1_EXIT_DECISION.md) — approved staged foundation exit.
4. [`DEPLOYMENT_PREREQUISITES.md`](./DEPLOYMENT_PREREQUISITES.md) — repository evidence versus external-environment proof.
5. [`AUDIT_REMEDIATION_PLAN.md`](./AUDIT_REMEDIATION_PLAN.md) — cleanup, evidence, owner-reduction, and authorization sequence.
6. [`ACTIVE_RUNTIME_BUDGET.json`](./ACTIVE_RUNTIME_BUDGET.json) — machine-readable active middleware inventory and ceilings.
7. [`STATUS_BOARD_RETIREMENT_MANIFEST.md`](./STATUS_BOARD_RETIREMENT_MANIFEST.md) — Status Board legacy-owner and middleware-rewrite retirement requirements.
8. [`STATUS_BOARD_UX_DECISIONS.md`](./STATUS_BOARD_UX_DECISIONS.md) — arrival-time semantics, phone composition, action parity, and scan-order decisions.
9. [`STATUS_BOARD_EVIDENCE_REVIEW_CONTRACT.md`](./STATUS_BOARD_EVIDENCE_REVIEW_CONTRACT.md) — sustained parity, manual evidence, environment evidence, and decision boundary.
10. [`STATUS_BOARD_MANUAL_EVIDENCE_MATRIX.md`](./STATUS_BOARD_MANUAL_EVIDENCE_MATRIX.md) — six-posture, accessibility, fullscreen, degraded-operation, and rollback checklist.
11. [`STATUS_BOARD_ROLLBACK_PLAN.md`](./STATUS_BOARD_ROLLBACK_PLAN.md) — immediate Build 1-only recovery procedure.
12. [`STATUS_BOARD_EVIDENCE_HARNESS.md`](./STATUS_BOARD_EVIDENCE_HARNESS.md) — fixture-only review surface, isolation, and evidence limits.

## Foundation and architecture contracts

- [`FOUNDATION_ALIGNMENT_GATE.md`](./FOUNDATION_ALIGNMENT_GATE.md)
- [`FOUNDATION_REVALIDATION_MATRIX.md`](./FOUNDATION_REVALIDATION_MATRIX.md)
- [`BUILD_2_CHARTER.md`](./BUILD_2_CHARTER.md)
- [`PHASE_1_OPERATIONAL_TRUTH.md`](./PHASE_1_OPERATIONAL_TRUTH.md)
- [`METRIC_PROVENANCE_REGISTRY.md`](./METRIC_PROVENANCE_REGISTRY.md)
- [`DOMAIN_CALCULATION_CATALOG.md`](./DOMAIN_CALCULATION_CATALOG.md)
- [`CANONICAL_ENTITY_CONTRACT.md`](./CANONICAL_ENTITY_CONTRACT.md)
- [`RECORD_NORMALIZATION_CONTRACT.md`](./RECORD_NORMALIZATION_CONTRACT.md)
- [`REPOSITORY_CONTRACTS.md`](./REPOSITORY_CONTRACTS.md)
- [`BACKEND_VERSIONING_AUDIT_CONTRACT.md`](./BACKEND_VERSIONING_AUDIT_CONTRACT.md)
- [`CRITICAL_WORKFLOW_ORCHESTRATION.md`](./CRITICAL_WORKFLOW_ORCHESTRATION.md)
- [`SYNCHRONIZATION_DEGRADED_OPERATION.md`](./SYNCHRONIZATION_DEGRADED_OPERATION.md)
- [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md)

## Application-foundation contracts

- [`PHASE_2_CHARTER.md`](./PHASE_2_CHARTER.md)
- [`GDL_FOUNDATIONS.md`](./GDL_FOUNDATIONS.md)
- [`GDL_TOKEN_REGISTRY.md`](./GDL_TOKEN_REGISTRY.md)
- [`COMPONENT_CONTRACTS.md`](./COMPONENT_CONTRACTS.md)
- [`COMPONENT_WORKSHOP.md`](./COMPONENT_WORKSHOP.md)
- [`APP_SHELL_CONTRACT.md`](./APP_SHELL_CONTRACT.md)
- [`ROUTE_PERMISSION_REGISTRY.md`](./ROUTE_PERMISSION_REGISTRY.md)
- [`FRONTEND_ARCHITECTURE_ADR.md`](./FRONTEND_ARCHITECTURE_ADR.md)
- [`RESPONSIVE_COMPOSITION_CONTRACTS.md`](./RESPONSIVE_COMPOSITION_CONTRACTS.md)
- [`RESPONSIVE_VALIDATION_MATRIX.md`](./RESPONSIVE_VALIDATION_MATRIX.md)
- [`ACCESSIBILITY_FOUNDATION.md`](./ACCESSIBILITY_FOUNDATION.md)
- [`ACCESSIBILITY_VALIDATION_MATRIX.md`](./ACCESSIBILITY_VALIDATION_MATRIX.md)

## Status Board migration contracts

- [`STATUS_BOARD_SHADOW_MIGRATION_AUTHORIZATION.md`](./STATUS_BOARD_SHADOW_MIGRATION_AUTHORIZATION.md)
- [`STATUS_BOARD_SHADOW_CONTRACT.md`](./STATUS_BOARD_SHADOW_CONTRACT.md)
- [`STATUS_BOARD_PARITY_MATRIX.md`](./STATUS_BOARD_PARITY_MATRIX.md)
- [`STATUS_BOARD_EVIDENCE_REVIEW_CONTRACT.md`](./STATUS_BOARD_EVIDENCE_REVIEW_CONTRACT.md)
- [`STATUS_BOARD_MANUAL_EVIDENCE_MATRIX.md`](./STATUS_BOARD_MANUAL_EVIDENCE_MATRIX.md)
- [`STATUS_BOARD_EVIDENCE_HARNESS.md`](./STATUS_BOARD_EVIDENCE_HARNESS.md)
- [`STATUS_BOARD_ROLLBACK_PLAN.md`](./STATUS_BOARD_ROLLBACK_PLAN.md)
- [`STATUS_BOARD_RETIREMENT_MANIFEST.md`](./STATUS_BOARD_RETIREMENT_MANIFEST.md)
- [`STATUS_BOARD_UX_DECISIONS.md`](./STATUS_BOARD_UX_DECISIONS.md)

## Execution reports

- Phase 1: `PHASE_1B_EXECUTION_REPORT.md` through `PHASE_1E_EXECUTION_REPORT.md`
- Phase 2: `PHASE_2A_EXECUTION_REPORT.md` through `PHASE_2_EXIT_REPORT.md`
- Foundation Alignment: `GATE_A_EXECUTION_REPORT.md` through `GATE_F_EXECUTION_REPORT.md`
- Phase 3A: `PHASE_3A_EXECUTION_REPORT.md`, `PHASE_3A_EVIDENCE_REVIEW_REPORT.md`, and `PHASE_3A_EVIDENCE_HARNESS_REPORT.md`
- Audit cleanup: [`AUDIT_REMEDIATION_GATE_1_REPORT.md`](./AUDIT_REMEDIATION_GATE_1_REPORT.md)

Historical execution reports remain evidence of their completed packages. They do not override the current governing set or the active runtime register.

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

The hidden bridge is loaded after the active Build 1 Status Board and timer owners. It observes Build 1 output and retains aggregate parity evidence in memory. The evidence harness is a separate fixture-only surface and is not loaded by middleware or registered as a route.

## Automated validation

```text
tests/runtime/record-display-integrity.test.mjs
tests/runtime/active-runtime-budget.test.mjs
tests/build-2/status-board-shadow/status-board-shadow.test.mjs
tests/build-2/status-board-shadow/status-board-evidence-review.test.mjs
tests/build-2/status-board-shadow/status-board-evidence-harness.test.mjs
.github/workflows/build-2-audit-remediation-gate-1.yml
.github/workflows/build-2-phase-3a-status-board-shadow.yml
.github/workflows/build-2-phase-3a-evidence-review.yml
.github/workflows/build-2-phase-3a-evidence-harness.yml
```

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
Phase 3A Evidence Harness                          COMPLETE / NON-PRODUCTION
Audit Remediation Gate 1                           IMPLEMENTED / VALIDATION PENDING
Audit Remediation Gate 2                           NOT STARTED
Phase 3B — Status Board Controlled Test Surface    NOT AUTHORIZED
Production Build 2 route activation               NOT AUTHORIZED
Build 2 production critical writes                NOT AUTHORIZED
Build 1 Status Board retirement                   NOT AUTHORIZED
Approved first route                              STATUS BOARD
```

## Integration rule

The active runtime may not grow above the governed Build 1 baseline. Phase 3B may be considered only after Audit Remediation Gates 1–3, Issue #48 evidence closure, external prerequisite verification, and a separate authorization decision. A visible Build 2 Status Board must reduce the active asset count, remove the competing Build 1 Status Board owner, and eliminate middleware Status Board source rewriting.
