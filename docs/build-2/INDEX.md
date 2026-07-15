# GATE Build 2 Documentation Index

Status: Foundation Alignment Gate C complete; Gate D next  
Runtime status: Build 1 UI remains active; the shared records API has the Gate C compatibility contract; Build 2 application assets remain staged.

## Governing documents

1. [`PROGRAM_INTENT_BASELINE.md`](./PROGRAM_INTENT_BASELINE.md) — governing mission, data, architecture, role, critical-write, archive, responsive, and migration-order baseline.
2. [`FOUNDATION_ALIGNMENT_GATE.md`](./FOUNDATION_ALIGNMENT_GATE.md) — Gates A–F scope, production block, and closure criteria.
3. [`PROGRAM_TRACEABILITY_MATRIX.md`](./PROGRAM_TRACEABILITY_MATRIX.md) — requirement-to-source, test, runtime, and remaining-gate mapping.
4. [`CANONICAL_ENTITY_CONTRACT.md`](./CANONICAL_ENTITY_CONTRACT.md) — direct canonical entity, provenance, alias, rollback, and unknown-record contract.
5. [`BACKEND_VERSIONING_AUDIT_CONTRACT.md`](./BACKEND_VERSIONING_AUDIT_CONTRACT.md) — server versions, conditional writes, role provenance, Squadron projection, and append-only audit contract.
6. [`BUILD_2_CHARTER.md`](./BUILD_2_CHARTER.md) — mission, architecture, migration, and definition of done.
7. [`PHASE_1_OPERATIONAL_TRUTH.md`](./PHASE_1_OPERATIONAL_TRUTH.md) — Phase 1 packages, gates, and exit criteria.
8. [`METRIC_PROVENANCE_REGISTRY.md`](./METRIC_PROVENANCE_REGISTRY.md) — operational definitions and calculation ownership.
9. [`DOMAIN_CALCULATION_CATALOG.md`](./DOMAIN_CALCULATION_CATALOG.md) — canonical selectors and report models.
10. [`RECORD_NORMALIZATION_CONTRACT.md`](./RECORD_NORMALIZATION_CONTRACT.md) — Build 1 compatibility and direct canonical handoff boundary.
11. [`REPOSITORY_CONTRACTS.md`](./REPOSITORY_CONTRACTS.md) — typed repositories, versioning, audit, and authorization boundaries.
12. [`PHASE_1B_EXECUTION_REPORT.md`](./PHASE_1B_EXECUTION_REPORT.md) — initial domain-core implementation report.
13. [`PHASE_1C_EXECUTION_REPORT.md`](./PHASE_1C_EXECUTION_REPORT.md) — normalization implementation report.
14. [`PHASE_1D_EXECUTION_REPORT.md`](./PHASE_1D_EXECUTION_REPORT.md) — repository-core implementation report.
15. [`PHASE_1E_EXECUTION_REPORT.md`](./PHASE_1E_EXECUTION_REPORT.md) — parity validation for the implemented Phase 1 subset.
16. [`VALIDATION_FIXTURES.md`](./VALIDATION_FIXTURES.md) — parity and data-integrity scenarios.
17. [`PHASE_2_CHARTER.md`](./PHASE_2_CHARTER.md) — application-foundation workstreams.
18. [`GDL_FOUNDATIONS.md`](./GDL_FOUNDATIONS.md) — GATE Design Language foundations.
19. [`GDL_TOKEN_REGISTRY.md`](./GDL_TOKEN_REGISTRY.md) — semantic token registry.
20. [`COMPONENT_CONTRACTS.md`](./COMPONENT_CONTRACTS.md) — canonical component contracts.
21. [`COMPONENT_WORKSHOP.md`](./COMPONENT_WORKSHOP.md) — staged component reference environment.
22. [`APP_SHELL_CONTRACT.md`](./APP_SHELL_CONTRACT.md) — canonical shell state and host responsibilities.
23. [`ROUTE_PERMISSION_REGISTRY.md`](./ROUTE_PERMISSION_REGISTRY.md) — routes, roles, and permissions.
24. [`FRONTEND_ARCHITECTURE_ADR.md`](./FRONTEND_ARCHITECTURE_ADR.md) — frontend architecture decision.
25. [`RESPONSIVE_COMPOSITION_CONTRACTS.md`](./RESPONSIVE_COMPOSITION_CONTRACTS.md) — responsive postures and ownership.
26. [`RESPONSIVE_VALIDATION_MATRIX.md`](./RESPONSIVE_VALIDATION_MATRIX.md) — responsive fixtures and thresholds.
27. [`ACCESSIBILITY_FOUNDATION.md`](./ACCESSIBILITY_FOUNDATION.md) — WCAG 2.2 AA foundation.
28. [`ACCESSIBILITY_VALIDATION_MATRIX.md`](./ACCESSIBILITY_VALIDATION_MATRIX.md) — accessibility evidence requirements.
29. [`PHASE_2A_EXECUTION_REPORT.md`](./PHASE_2A_EXECUTION_REPORT.md)
30. [`PHASE_2B_EXECUTION_REPORT.md`](./PHASE_2B_EXECUTION_REPORT.md)
31. [`PHASE_2C_EXECUTION_REPORT.md`](./PHASE_2C_EXECUTION_REPORT.md)
32. [`PHASE_2D_EXECUTION_REPORT.md`](./PHASE_2D_EXECUTION_REPORT.md)
33. [`PHASE_2E_EXECUTION_REPORT.md`](./PHASE_2E_EXECUTION_REPORT.md)
34. [`PHASE_2_EXIT_REPORT.md`](./PHASE_2_EXIT_REPORT.md)
35. [`GATE_A_EXECUTION_REPORT.md`](./GATE_A_EXECUTION_REPORT.md) — completed Gate A record.
36. [`GATE_B_EXECUTION_REPORT.md`](./GATE_B_EXECUTION_REPORT.md) — completed Gate B record.
37. [`GATE_C_EXECUTION_REPORT.md`](./GATE_C_EXECUTION_REPORT.md) — completed Gate C record.

## Gate C server and persistence source

```text
functions/api/
├── _middleware.js
├── session-contract.mjs
├── records-contract.mjs
└── records.js

migrations/
└── 0002_gate_c_append_only_audit.sql

public/app/data/
├── records-client.mjs
├── record-normalizer.mjs
├── repository-result.mjs
└── repositories/
    ├── base-repository.mjs
    └── audit-repository.mjs
```

Build 2 design, component, shell, responsive, accessibility, and feature assets remain absent from the active middleware asset manifest.

## Automated validation

```text
tests/build-2/server/records-api.test.mjs
tests/build-2/data/*.test.mjs
tests/build-2/domain/*.test.mjs
tests/build-2/parity/*.test.mjs
tests/build-2/design/*.test.mjs
tests/build-2/components/*.test.mjs
tests/build-2/shell/*.test.mjs
tests/build-2/responsive/*.test.mjs
tests/build-2/accessibility/*.test.mjs
.github/workflows/build-2-gate-c-tests.yml
```

## Current execution position

```text
Phase 1A — Operational Truth Registry             COMPLETE
Phase 1B — Canonical Domain Core                  COMPLETE / STAGED
Phase 1C — Compatibility and Canonical Entity     COMPLETE / STAGED
Phase 1D — Repository, Versioning, and Audit       COMPLETE
Phase 1E — Parity Validation                      COMPLETE FOR IMPLEMENTED SCOPE

Phase 2A–2E — Application Foundation              COMPLETE / STAGED

Foundation Alignment Gate A                       COMPLETE / STAGED
Foundation Alignment Gate B                       COMPLETE / STAGED
Foundation Alignment Gate C                       COMPLETE
Foundation Alignment Gate D                       NEXT
Foundation Alignment Gates E–F                    NOT STARTED

Phase 3 — Feature Migration and Legacy Retirement BLOCKED UNTIL GATES A–F CLOSE
Approved first route                              STATUS BOARD
```

## Integration rule

No Build 2 feature route activates until Gates A–F close and a Status Board-specific migration gate approves parity, authorization, persistence, responsive/accessibility evidence, activation, rollback, and corresponding Build 1 retirement.
