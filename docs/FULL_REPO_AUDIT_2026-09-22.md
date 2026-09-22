# GATE Full Repository Audit — 2026-09-22

Status: **IN PROGRESS**  
Baseline: `main@3dcdc6849e45a41c7601e14ddfd6ba1e27724942`  
Audit branch: `audit/full-repo-20260922`

## Audit purpose

This ledger is the persistent memory for the repository-wide line-by-line audit. No file is deleted merely because another file looks newer. Every duplicate or competing implementation is traced through runtime loading, callers, tests, migrations, documentation, and operational behavior before a retention/deletion decision is made.

Primary objectives:

1. Preserve all operational functionality and D1/archive integrity.
2. Identify competing owners, obsolete compatibility code, dead source, stale docs, redundant tests/workflows, and unused assets.
3. Retain the single best implementation of each behavior.
4. Reduce active runtime bloat before reducing historical/development material.
5. Limit UI changes to bug fixes, conflict removal, accessibility/containment corrections, and ownership simplification.
6. Run the complete regression suite after each cleanup tranche.

## Non-negotiable invariants

- Do not rewrite or delete historical D1 archive data as part of source cleanup.
- Server authorization remains authoritative.
- No trainee PII/CUI expansion.
- Preserve Instructor, Airman, and Squadron role boundaries.
- Preserve Airport → Processing → Status → Closeout → Archive workflows.
- Preserve lossless closeout and append-only audit/amendment protections.
- One production stylesheet remains the target.
- A source owner is retired only after all live callers are redirected and tests are updated.
- Migration files already applied to D1 are immutable historical artifacts unless proven never deployed.
- Binary assets are reviewed by reference graph and byte identity rather than line-by-line text.

## Baseline inventory

- Git tree entries: 423
- Files: 368
- Direct production stylesheets: 1
- Direct production scripts: 28
- Canonical stylesheet: `public/css/military-glass-terminal.css`
- Current visible runtime: Build 1 shell plus canonical controllers and one hidden Build 2 Status Board observer.

## Confirmed findings already identified

- `README.md` is stale: it still states 13 directly injected stylesheets and 3 imported stylesheets while middleware and the governed runtime budget now use 1 direct stylesheet and 0 imports.
- The current middleware still performs source-time rewrites of legacy inline Status Board markup/functions. This is a strong conflict/bloat candidate, but it cannot be removed until the corresponding source markup/functions in `public/index.html` are made canonical and runtime parity is proven.
- Three grandfathered active corrective assets remain explicitly tracked: `prc-dash-runtime-fixes.js`, `prc-dash-modal-mobile-validation.js`, and `gate-render-stability-fix.js`. They require direct line-by-line comparison against the canonical owners before retirement.
- The active script count is at the governed ceiling of 28 rather than the Phase 3B target of 24; this audit will attempt safe consolidation/retirement rather than adding layers.

## File ledger

Decision values will move from `UNREVIEWED` → `KEEP`, `KEEP-HISTORICAL`, `MERGE`, `RETIRE`, `DELETE`, or `FIX`.

| File | Category | Bytes | Decision | Notes |
|---|---|---:|---|---|
| `.github/workflows/build-2-accessibility-tests.yml` | workflow | 2877 | UNREVIEWED | — |
| `.github/workflows/build-2-audit-remediation-gate-1.yml` | workflow | 5800 | UNREVIEWED | — |
| `.github/workflows/build-2-component-tests.yml` | workflow | 1640 | UNREVIEWED | — |
| `.github/workflows/build-2-data-tests.yml` | workflow | 899 | UNREVIEWED | — |
| `.github/workflows/build-2-design-tests.yml` | workflow | 1361 | UNREVIEWED | — |
| `.github/workflows/build-2-domain-tests.yml` | workflow | 831 | UNREVIEWED | — |
| `.github/workflows/build-2-foundation-alignment-tests.yml` | workflow | 3011 | UNREVIEWED | — |
| `.github/workflows/build-2-gate-b-tests.yml` | workflow | 3133 | UNREVIEWED | — |
| `.github/workflows/build-2-gate-c-tests.yml` | workflow | 4222 | UNREVIEWED | — |
| `.github/workflows/build-2-gate-d-tests.yml` | workflow | 3986 | UNREVIEWED | — |
| `.github/workflows/build-2-gate-e-tests.yml` | workflow | 5193 | UNREVIEWED | — |
| `.github/workflows/build-2-gate-f-tests.yml` | workflow | 6052 | UNREVIEWED | — |
| `.github/workflows/build-2-phase-1-validation.yml` | workflow | 1228 | UNREVIEWED | — |
| `.github/workflows/build-2-phase-3a-evidence-harness.yml` | workflow | 4835 | UNREVIEWED | — |
| `.github/workflows/build-2-phase-3a-evidence-review.yml` | workflow | 5482 | UNREVIEWED | — |
| `.github/workflows/build-2-phase-3a-status-board-shadow.yml` | workflow | 5695 | UNREVIEWED | — |
| `.github/workflows/build-2-responsive-tests.yml` | workflow | 2670 | UNREVIEWED | — |
| `.github/workflows/build-2-shell-tests.yml` | workflow | 2944 | UNREVIEWED | — |
| `.github/workflows/runtime-record-integrity-tests.yml` | workflow | 4574 | UNREVIEWED | — |
| `.gitignore` | configuration | 139 | UNREVIEWED | — |
| `README.md` | documentation | 6297 | UNREVIEWED | — |
| `docs/ACTIVE_RUNTIME_STACK.md` | documentation | 10649 | UNREVIEWED | — |
| `docs/CONFLICT_REMOVAL_PLAN.md` | documentation | 9464 | UNREVIEWED | — |
| `docs/D1_PERSISTENCE_CUTOVER.md` | documentation | 7300 | UNREVIEWED | — |
| `docs/ENTERPRISE_INDEX.md` | documentation | 10248 | UNREVIEWED | — |
| `docs/FINAL_BETA_UI_UX_CULL_AUDIT_2026-09-13.md` | documentation | 44882 | UNREVIEWED | — |
| `docs/MOBILE_SHELL_DECISION.md` | documentation | 6718 | UNREVIEWED | — |
| `docs/PERSISTENCE_HARDENING_GATE_01.md` | documentation | 4055 | UNREVIEWED | — |
| `docs/PHASE_1A_APP_SHELL.md` | documentation | 5324 | UNREVIEWED | — |
| `docs/PHASE_1B_STATUS_METRICS.md` | documentation | 5184 | UNREVIEWED | — |
| `docs/PHASE_1C_STATUS_BOARD.md` | documentation | 5363 | UNREVIEWED | — |
| `docs/PHASE_2_PROCESSING.md` | documentation | 6058 | UNREVIEWED | — |
| `docs/PHASE_3_BUS_WORKFLOW.md` | documentation | 5087 | UNREVIEWED | — |
| `docs/PHASE_4_INPUT_INITIALIZATION.md` | documentation | 6182 | UNREVIEWED | — |
| `docs/PHASE_5_ARCHIVE_REPORTING_CLOSEOUT.md` | documentation | 10710 | UNREVIEWED | — |
| `docs/PHASE_6B_PRINT_RUNTIME_CLEANUP.md` | documentation | 2174 | UNREVIEWED | — |
| `docs/PHASE_6_RUNTIME_HARDENING.md` | documentation | 4392 | UNREVIEWED | — |
| `docs/PHASE_7B_RENDER_STABILITY_GUARD.md` | documentation | 2785 | UNREVIEWED | — |
| `docs/PHASE_7C_PHONE_UI_CORRECTION.md` | documentation | 3163 | UNREVIEWED | — |
| `docs/PHASE_7D_PHONE_SHEET_METRICS.md` | documentation | 2633 | UNREVIEWED | — |
| `docs/PHASE_7E_UI_OWNERSHIP_CORRECTION.md` | documentation | 4144 | UNREVIEWED | — |
| `docs/PHASE_7G_VIEWPORT_WATERMARK.md` | documentation | 2771 | UNREVIEWED | — |
| `docs/PHASE_7H_UI_PATCH_RETIREMENT.md` | documentation | 2597 | UNREVIEWED | — |
| `docs/PHASE_7_MOBILE_UI_POLISH.md` | documentation | 4234 | UNREVIEWED | — |
| `docs/PHASE_8_STATIC_VALIDATION_MATRIX.md` | documentation | 5680 | UNREVIEWED | — |
| `docs/RECORD_CONTRACT.md` | documentation | 7946 | UNREVIEWED | — |
| `docs/RECORD_DISPLAY_INTEGRITY_INCIDENT.md` | documentation | 5277 | UNREVIEWED | — |
| `docs/UI_LAYER_CATALOG.md` | documentation | 4858 | UNREVIEWED | — |
| `docs/UI_OWNERSHIP_MAP.md` | documentation | 10064 | UNREVIEWED | — |
| `docs/build-2/ACCESSIBILITY_FOUNDATION.md` | documentation | 6099 | UNREVIEWED | — |
| `docs/build-2/ACCESSIBILITY_VALIDATION_MATRIX.md` | documentation | 4162 | UNREVIEWED | — |
| `docs/build-2/ACTIVE_RUNTIME_BUDGET.json` | documentation | 3259 | UNREVIEWED | — |
| `docs/build-2/APP_SHELL_CONTRACT.md` | documentation | 5347 | UNREVIEWED | — |
| `docs/build-2/AUDIT_REMEDIATION_GATE_1_REPORT.md` | documentation | 3778 | UNREVIEWED | — |
| `docs/build-2/AUDIT_REMEDIATION_PLAN.md` | documentation | 3688 | UNREVIEWED | — |
| `docs/build-2/BACKEND_VERSIONING_AUDIT_CONTRACT.md` | documentation | 5270 | UNREVIEWED | — |
| `docs/build-2/BUILD_2_CHARTER.md` | documentation | 5139 | UNREVIEWED | — |
| `docs/build-2/CANONICAL_ENTITY_CONTRACT.md` | documentation | 3548 | UNREVIEWED | — |
| `docs/build-2/COMPONENT_CONTRACTS.md` | documentation | 5231 | UNREVIEWED | — |
| `docs/build-2/COMPONENT_WORKSHOP.md` | documentation | 3677 | UNREVIEWED | — |
| `docs/build-2/CORRECTED_PHASE_1_EXIT_DECISION.md` | documentation | 4033 | UNREVIEWED | — |
| `docs/build-2/CRITICAL_WORKFLOW_ORCHESTRATION.md` | documentation | 6861 | UNREVIEWED | — |
| `docs/build-2/DEPLOYMENT_PREREQUISITES.md` | documentation | 4528 | UNREVIEWED | — |
| `docs/build-2/DOMAIN_CALCULATION_CATALOG.md` | documentation | 8428 | UNREVIEWED | — |
| `docs/build-2/FOUNDATION_ALIGNMENT_GATE.md` | documentation | 4217 | UNREVIEWED | — |
| `docs/build-2/FOUNDATION_REVALIDATION_MATRIX.md` | documentation | 2950 | UNREVIEWED | — |
| `docs/build-2/FRONTEND_ARCHITECTURE_ADR.md` | documentation | 3071 | UNREVIEWED | — |
| `docs/build-2/GATE_A_EXECUTION_REPORT.md` | documentation | 2889 | UNREVIEWED | — |
| `docs/build-2/GATE_B_EXECUTION_REPORT.md` | documentation | 2850 | UNREVIEWED | — |
| `docs/build-2/GATE_C_EXECUTION_REPORT.md` | documentation | 4045 | UNREVIEWED | — |
| `docs/build-2/GATE_D_EXECUTION_REPORT.md` | documentation | 4434 | UNREVIEWED | — |
| `docs/build-2/GATE_E_EXECUTION_REPORT.md` | documentation | 4023 | UNREVIEWED | — |
| `docs/build-2/GATE_F_EXECUTION_REPORT.md` | documentation | 3879 | UNREVIEWED | — |
| `docs/build-2/GDL_FOUNDATIONS.md` | documentation | 2921 | UNREVIEWED | — |
| `docs/build-2/GDL_TOKEN_REGISTRY.md` | documentation | 2127 | UNREVIEWED | — |
| `docs/build-2/INDEX.md` | documentation | 8608 | UNREVIEWED | — |
| `docs/build-2/METRIC_PROVENANCE_REGISTRY.md` | documentation | 16567 | UNREVIEWED | — |
| `docs/build-2/PHASE_1B_EXECUTION_REPORT.md` | documentation | 3283 | UNREVIEWED | — |
| `docs/build-2/PHASE_1C_EXECUTION_REPORT.md` | documentation | 5575 | UNREVIEWED | — |
| `docs/build-2/PHASE_1D_EXECUTION_REPORT.md` | documentation | 6541 | UNREVIEWED | — |
| `docs/build-2/PHASE_1E_EXECUTION_REPORT.md` | documentation | 2799 | UNREVIEWED | — |
| `docs/build-2/PHASE_1_OPERATIONAL_TRUTH.md` | documentation | 7359 | UNREVIEWED | — |
| `docs/build-2/PHASE_2A_EXECUTION_REPORT.md` | documentation | 2701 | UNREVIEWED | — |
| `docs/build-2/PHASE_2B_EXECUTION_REPORT.md` | documentation | 4745 | UNREVIEWED | — |
| `docs/build-2/PHASE_2C_EXECUTION_REPORT.md` | documentation | 5166 | UNREVIEWED | — |
| `docs/build-2/PHASE_2D_EXECUTION_REPORT.md` | documentation | 5105 | UNREVIEWED | — |
| `docs/build-2/PHASE_2E_EXECUTION_REPORT.md` | documentation | 3728 | UNREVIEWED | — |
| `docs/build-2/PHASE_2_CHARTER.md` | documentation | 2467 | UNREVIEWED | — |
| `docs/build-2/PHASE_2_EXIT_REPORT.md` | documentation | 3039 | UNREVIEWED | — |
| `docs/build-2/PHASE_3A_EVIDENCE_HARNESS_REPORT.md` | documentation | 3576 | UNREVIEWED | — |
| `docs/build-2/PHASE_3A_EVIDENCE_REVIEW_REPORT.md` | documentation | 5433 | UNREVIEWED | — |
| `docs/build-2/PHASE_3A_EXECUTION_REPORT.md` | documentation | 5356 | UNREVIEWED | — |
| `docs/build-2/PROGRAM_INTENT_BASELINE.md` | documentation | 7929 | UNREVIEWED | — |
| `docs/build-2/PROGRAM_TRACEABILITY_MATRIX.md` | documentation | 10530 | UNREVIEWED | — |
| `docs/build-2/README.md` | documentation | 2430 | UNREVIEWED | — |
| `docs/build-2/RECORD_NORMALIZATION_CONTRACT.md` | documentation | 4911 | UNREVIEWED | — |
| `docs/build-2/REPOSITORY_CONTRACTS.md` | documentation | 4656 | UNREVIEWED | — |
| `docs/build-2/RESPONSIVE_COMPOSITION_CONTRACTS.md` | documentation | 6030 | UNREVIEWED | — |
| `docs/build-2/RESPONSIVE_VALIDATION_MATRIX.md` | documentation | 4340 | UNREVIEWED | — |
| `docs/build-2/ROUTE_PERMISSION_REGISTRY.md` | documentation | 3047 | UNREVIEWED | — |
| `docs/build-2/STATUS_BOARD_EVIDENCE_HARNESS.md` | documentation | 4030 | UNREVIEWED | — |
| `docs/build-2/STATUS_BOARD_EVIDENCE_REVIEW_CONTRACT.md` | documentation | 5452 | UNREVIEWED | — |
| `docs/build-2/STATUS_BOARD_MANUAL_EVIDENCE_MATRIX.md` | documentation | 5004 | UNREVIEWED | — |
| `docs/build-2/STATUS_BOARD_PARITY_MATRIX.md` | documentation | 2839 | UNREVIEWED | — |
| `docs/build-2/STATUS_BOARD_RETIREMENT_MANIFEST.md` | documentation | 6988 | UNREVIEWED | — |
| `docs/build-2/STATUS_BOARD_ROLLBACK_PLAN.md` | documentation | 2557 | UNREVIEWED | — |
| `docs/build-2/STATUS_BOARD_SHADOW_CONTRACT.md` | documentation | 6942 | UNREVIEWED | — |
| `docs/build-2/STATUS_BOARD_SHADOW_MIGRATION_AUTHORIZATION.md` | documentation | 3832 | UNREVIEWED | — |
| `docs/build-2/STATUS_BOARD_UX_DECISIONS.md` | documentation | 3579 | UNREVIEWED | — |
| `docs/build-2/SYNCHRONIZATION_DEGRADED_OPERATION.md` | documentation | 4844 | UNREVIEWED | — |
| `docs/build-2/VALIDATION_FIXTURES.md` | documentation | 6840 | UNREVIEWED | — |
| `docs/modal-map.md` | documentation | 4567 | UNREVIEWED | — |
| `docs/phase-14-file-audit.md` | documentation | 1457 | UNREVIEWED | — |
| `docs/ui-page-validation-pass.md` | documentation | 13638 | UNREVIEWED | — |
| `docs/ui-stack-audit.md` | documentation | 8876 | UNREVIEWED | — |
| `functions/_middleware.js` | middleware | 16120 | UNREVIEWED | — |
| `functions/api/_middleware.js` | server API | 4719 | UNREVIEWED | — |
| `functions/api/archive-delete.js` | server API | 3404 | UNREVIEWED | — |
| `functions/api/archives.js` | server API | 9231 | UNREVIEWED | — |
| `functions/api/login.js` | server API | 3890 | UNREVIEWED | — |
| `functions/api/logout.js` | server API | 330 | UNREVIEWED | — |
| `functions/api/persistence-core.mjs` | server API | 12135 | UNREVIEWED | — |
| `functions/api/persistence.js` | server API | 25176 | UNREVIEWED | — |
| `functions/api/ping.js` | server API | 199 | UNREVIEWED | — |
| `functions/api/records-contract.mjs` | server API | 4685 | UNREVIEWED | — |
| `functions/api/records.js` | server API | 13369 | UNREVIEWED | — |
| `functions/api/sat-arrivals.js` | server API | 9404 | UNREVIEWED | — |
| `functions/api/session-contract.mjs` | server API | 3584 | UNREVIEWED | — |
| `functions/api/session.js` | server API | 826 | UNREVIEWED | — |
| `functions/api/squadron-board.js` | server API | 18501 | UNREVIEWED | — |
| `migrations/0002_gate_c_append_only_audit.sql` | database | 355 | UNREVIEWED | — |
| `migrations/0003_gate_persistence_foundation.sql` | database | 13706 | UNREVIEWED | — |
| `migrations/0004_gate_record_audit_triggers.sql` | database | 3213 | UNREVIEWED | — |
| `migrations/0005_gate_squadron_notices.sql` | database | 941 | UNREVIEWED | — |
| `migrations/0006_gate_squadron_information_revisions.sql` | database | 983 | UNREVIEWED | — |
| `public/app/accessibility/announcer.mjs` | Build 2/staged app | 1235 | UNREVIEWED | — |
| `public/app/accessibility/contract-registry.mjs` | Build 2/staged app | 3291 | UNREVIEWED | — |
| `public/app/accessibility/focus-contract.mjs` | Build 2/staged app | 1839 | UNREVIEWED | — |
| `public/app/accessibility/gate-accessibility.css` | Build 2/staged app | 3719 | UNREVIEWED | — |
| `public/app/accessibility/index.mjs` | Build 2/staged app | 420 | UNREVIEWED | — |
| `public/app/accessibility/overlay-controller.mjs` | Build 2/staged app | 4898 | UNREVIEWED | — |
| `public/app/accessibility/workshop/index.html` | Build 2/staged app | 2603 | UNREVIEWED | — |
| `public/app/accessibility/workshop/workshop.css` | Build 2/staged app | 1712 | UNREVIEWED | — |
| `public/app/accessibility/workshop/workshop.mjs` | Build 2/staged app | 3900 | UNREVIEWED | — |
| `public/app/components/contracts.mjs` | Build 2/staged app | 8341 | UNREVIEWED | — |
| `public/app/components/gate-components.css` | Build 2/staged app | 10505 | UNREVIEWED | — |
| `public/app/components/index.mjs` | Build 2/staged app | 424 | UNREVIEWED | — |
| `public/app/components/render-utils.mjs` | Build 2/staged app | 1643 | UNREVIEWED | — |
| `public/app/components/renderers-core.mjs` | Build 2/staged app | 5916 | UNREVIEWED | — |
| `public/app/components/renderers-operational.mjs` | Build 2/staged app | 6132 | UNREVIEWED | — |
| `public/app/data/canonical-entity.mjs` | Build 2/staged app | 3259 | UNREVIEWED | — |
| `public/app/data/index.mjs` | Build 2/staged app | 1205 | UNREVIEWED | — |
| `public/app/data/legacy-compatibility.mjs` | Build 2/staged app | 5467 | UNREVIEWED | — |
| `public/app/data/provenance.mjs` | Build 2/staged app | 1369 | UNREVIEWED | — |
| `public/app/data/record-normalizer.mjs` | Build 2/staged app | 12999 | UNREVIEWED | — |
| `public/app/data/records-client.mjs` | Build 2/staged app | 6846 | UNREVIEWED | — |
| `public/app/data/repositories/archive-repository.mjs` | Build 2/staged app | 5145 | UNREVIEWED | — |
| `public/app/data/repositories/audit-repository.mjs` | Build 2/staged app | 4264 | UNREVIEWED | — |
| `public/app/data/repositories/base-repository.mjs` | Build 2/staged app | 3810 | UNREVIEWED | — |
| `public/app/data/repositories/bus-repository.mjs` | Build 2/staged app | 5165 | UNREVIEWED | — |
| `public/app/data/repositories/config-repository.mjs` | Build 2/staged app | 3370 | UNREVIEWED | — |
| `public/app/data/repositories/dorm-repository.mjs` | Build 2/staged app | 5448 | UNREVIEWED | — |
| `public/app/data/repositories/index.mjs` | Build 2/staged app | 439 | UNREVIEWED | — |
| `public/app/data/repositories/sound-event-repository.mjs` | Build 2/staged app | 1023 | UNREVIEWED | — |
| `public/app/data/repository-result.mjs` | Build 2/staged app | 2641 | UNREVIEWED | — |
| `public/app/design/index.mjs` | Build 2/staged app | 1818 | UNREVIEWED | — |
| `public/app/design/themes/gdl-foundations.css` | Build 2/staged app | 2646 | UNREVIEWED | — |
| `public/app/design/tokens/foundations.mjs` | Build 2/staged app | 1695 | UNREVIEWED | — |
| `public/app/design/tokens/semantic.mjs` | Build 2/staged app | 1689 | UNREVIEWED | — |
| `public/app/domain/archives.mjs` | Build 2/staged app | 3996 | UNREVIEWED | — |
| `public/app/domain/arrivals.mjs` | Build 2/staged app | 1500 | UNREVIEWED | — |
| `public/app/domain/buses.mjs` | Build 2/staged app | 952 | UNREVIEWED | — |
| `public/app/domain/dorms.mjs` | Build 2/staged app | 1752 | UNREVIEWED | — |
| `public/app/domain/index.mjs` | Build 2/staged app | 398 | UNREVIEWED | — |
| `public/app/domain/normalization.mjs` | Build 2/staged app | 5610 | UNREVIEWED | — |
| `public/app/domain/operational-metrics.mjs` | Build 2/staged app | 3391 | UNREVIEWED | — |
| `public/app/domain/processing.mjs` | Build 2/staged app | 1576 | UNREVIEWED | — |
| `public/app/domain/receiving.mjs` | Build 2/staged app | 6079 | UNREVIEWED | — |
| `public/app/domain/reports.mjs` | Build 2/staged app | 1185 | UNREVIEWED | — |
| `public/app/domain/summaries.mjs` | Build 2/staged app | 2397 | UNREVIEWED | — |
| `public/app/domain/timers.mjs` | Build 2/staged app | 2047 | UNREVIEWED | — |
| `public/app/domain/week-groups.mjs` | Build 2/staged app | 1787 | UNREVIEWED | — |
| `public/app/features/input/flight-alert-import.mjs` | Build 2/staged app | 22626 | UNREVIEWED | — |
| `public/app/features/input/flight-alert-parser.mjs` | Build 2/staged app | 8507 | UNREVIEWED | — |
| `public/app/features/input/flight-alert-pdf.mjs` | Build 2/staged app | 5889 | UNREVIEWED | — |
| `public/app/features/input/week-group-action-placement.mjs` | Build 2/staged app | 7227 | UNREVIEWED | — |
| `public/app/offline/cache-policy.mjs` | Build 2/staged app | 1674 | UNREVIEWED | — |
| `public/app/offline/index.mjs` | Build 2/staged app | 87 | UNREVIEWED | — |
| `public/app/offline/service-worker-registration.mjs` | Build 2/staged app | 504 | UNREVIEWED | — |
| `public/app/responsive/composition-selector.mjs` | Build 2/staged app | 4390 | UNREVIEWED | — |
| `public/app/responsive/container-registry.mjs` | Build 2/staged app | 2310 | UNREVIEWED | — |
| `public/app/responsive/gate-responsive.css` | Build 2/staged app | 6986 | UNREVIEWED | — |
| `public/app/responsive/index.mjs` | Build 2/staged app | 502 | UNREVIEWED | — |
| `public/app/responsive/posture-registry.mjs` | Build 2/staged app | 5680 | UNREVIEWED | — |
| `public/app/responsive/workshop/fixtures.mjs` | Build 2/staged app | 1164 | UNREVIEWED | — |
| `public/app/responsive/workshop/index.html` | Build 2/staged app | 1457 | UNREVIEWED | — |
| `public/app/responsive/workshop/workshop.css` | Build 2/staged app | 2876 | UNREVIEWED | — |
| `public/app/responsive/workshop/workshop.mjs` | Build 2/staged app | 2930 | UNREVIEWED | — |
| `public/app/shell/gate-shell.css` | Build 2/staged app | 6782 | UNREVIEWED | — |
| `public/app/shell/index.mjs` | Build 2/staged app | 217 | UNREVIEWED | — |
| `public/app/shell/permission-registry.mjs` | Build 2/staged app | 2858 | UNREVIEWED | — |
| `public/app/shell/renderers.mjs` | Build 2/staged app | 5061 | UNREVIEWED | — |
| `public/app/shell/route-registry.mjs` | Build 2/staged app | 4065 | UNREVIEWED | — |
| `public/app/shell/selectors.mjs` | Build 2/staged app | 3623 | UNREVIEWED | — |
| `public/app/shell/shell-state.mjs` | Build 2/staged app | 9732 | UNREVIEWED | — |
| `public/app/shell/shell-store.mjs` | Build 2/staged app | 982 | UNREVIEWED | — |
| `public/app/shell/workshop/index.html` | Build 2/staged app | 620 | UNREVIEWED | — |
| `public/app/shell/workshop/workshop.css` | Build 2/staged app | 1458 | UNREVIEWED | — |
| `public/app/shell/workshop/workshop.mjs` | Build 2/staged app | 6964 | UNREVIEWED | — |
| `public/app/status-board-shadow/canonical-snapshot.mjs` | Build 2/staged app | 3039 | UNREVIEWED | — |
| `public/app/status-board-shadow/contracts.mjs` | Build 2/staged app | 1664 | UNREVIEWED | — |
| `public/app/status-board-shadow/deployment-evidence.mjs` | Build 2/staged app | 3196 | UNREVIEWED | — |
| `public/app/status-board-shadow/evidence-ledger.mjs` | Build 2/staged app | 2601 | UNREVIEWED | — |
| `public/app/status-board-shadow/index.mjs` | Build 2/staged app | 533 | UNREVIEWED | — |
| `public/app/status-board-shadow/legacy-snapshot.mjs` | Build 2/staged app | 2264 | UNREVIEWED | — |
| `public/app/status-board-shadow/manual-evidence.mjs` | Build 2/staged app | 3679 | UNREVIEWED | — |
| `public/app/status-board-shadow/mismatch-disposition.mjs` | Build 2/staged app | 3415 | UNREVIEWED | — |
| `public/app/status-board-shadow/parity.mjs` | Build 2/staged app | 5792 | UNREVIEWED | — |
| `public/app/status-board-shadow/review-contract.mjs` | Build 2/staged app | 4723 | UNREVIEWED | — |
| `public/app/status-board-shadow/review-evaluator.mjs` | Build 2/staged app | 5268 | UNREVIEWED | — |
| `public/app/status-board-shadow/review-harness/fixtures.mjs` | Build 2/staged app | 2349 | UNREVIEWED | — |
| `public/app/status-board-shadow/review-harness/index.html` | Build 2/staged app | 4868 | UNREVIEWED | — |
| `public/app/status-board-shadow/review-harness/review-harness-tokens.css` | Build 2/staged app | 469 | UNREVIEWED | — |
| `public/app/status-board-shadow/review-harness/review-harness.css` | Build 2/staged app | 7808 | UNREVIEWED | — |
| `public/app/status-board-shadow/review-harness/review-harness.mjs` | Build 2/staged app | 13517 | UNREVIEWED | — |
| `public/app/status-board-shadow/rollback-contract.mjs` | Build 2/staged app | 2442 | UNREVIEWED | — |
| `public/app/status-board-shadow/route-contract.mjs` | Build 2/staged app | 4664 | UNREVIEWED | — |
| `public/app/status-board-shadow/runner.mjs` | Build 2/staged app | 1479 | UNREVIEWED | — |
| `public/app/status-board-shadow/sync-adapter.mjs` | Build 2/staged app | 3522 | UNREVIEWED | — |
| `public/app/synchronization/authoritative-store.mjs` | Build 2/staged app | 1765 | UNREVIEWED | — |
| `public/app/synchronization/guarded-records-client.mjs` | Build 2/staged app | 1639 | UNREVIEWED | — |
| `public/app/synchronization/index.mjs` | Build 2/staged app | 243 | UNREVIEWED | — |
| `public/app/synchronization/invalidation-channel.mjs` | Build 2/staged app | 3655 | UNREVIEWED | — |
| `public/app/synchronization/shell-bridge.mjs` | Build 2/staged app | 1693 | UNREVIEWED | — |
| `public/app/synchronization/sync-coordinator.mjs` | Build 2/staged app | 4430 | UNREVIEWED | — |
| `public/app/synchronization/sync-state.mjs` | Build 2/staged app | 5303 | UNREVIEWED | — |
| `public/app/workflows/archive-workflows.mjs` | Build 2/staged app | 24746 | UNREVIEWED | — |
| `public/app/workflows/arrival-workflows.mjs` | Build 2/staged app | 7647 | UNREVIEWED | — |
| `public/app/workflows/dorm-workflows.mjs` | Build 2/staged app | 6193 | UNREVIEWED | — |
| `public/app/workflows/index.mjs` | Build 2/staged app | 333 | UNREVIEWED | — |
| `public/app/workflows/initialization-recovery.mjs` | Build 2/staged app | 5330 | UNREVIEWED | — |
| `public/app/workflows/initialize-week-group.mjs` | Build 2/staged app | 14110 | UNREVIEWED | — |
| `public/app/workflows/recovery-workflows.mjs` | Build 2/staged app | 1429 | UNREVIEWED | — |
| `public/app/workflows/workflow-helpers.mjs` | Build 2/staged app | 2441 | UNREVIEWED | — |
| `public/app/workflows/workflow-result.mjs` | Build 2/staged app | 3258 | UNREVIEWED | — |
| `public/app/workshop/fixtures.mjs` | Build 2/staged app | 2215 | UNREVIEWED | — |
| `public/app/workshop/index.html` | Build 2/staged app | 1428 | UNREVIEWED | — |
| `public/app/workshop/workshop.css` | Build 2/staged app | 2457 | UNREVIEWED | — |
| `public/app/workshop/workshop.mjs` | Build 2/staged app | 7440 | UNREVIEWED | — |
| `public/assets/gate_bus_sound.mp3` | binary asset | 33024 | UNREVIEWED | — |
| `public/assets/gate_closed_sound.mp3` | binary asset | 58514 | UNREVIEWED | — |
| `public/assets/gate_emblem_blue.png` | binary asset | 288095 | UNREVIEWED | — |
| `public/assets/gate_emblem_small.png` | binary asset | 30478 | UNREVIEWED | — |
| `public/assets/gate_emblem_white.png` | binary asset | 216338 | UNREVIEWED | — |
| `public/assets/gate_enable_sound.mp3` | binary asset | 49319 | UNREVIEWED | — |
| `public/assets/gate_error_sound.mp3` | binary asset | 39288 | UNREVIEWED | — |
| `public/assets/gate_open_sound.mp3` | binary asset | 54334 | UNREVIEWED | — |
| `public/assets/gate_overtime_sound.mp3` | binary asset | 39288 | UNREVIEWED | — |
| `public/assets/gate_submark_blue.png` | binary asset | 125358 | UNREVIEWED | — |
| `public/assets/gate_submark_white.png` | binary asset | 85514 | UNREVIEWED | — |
| `public/assets/prc-logo-blue.png` | binary asset | 538027 | UNREVIEWED | — |
| `public/assets/sr_bus_sound.mp3` | binary asset | 35108 | UNREVIEWED | — |
| `public/assets/sr_closed_sound.mp3` | binary asset | 54334 | UNREVIEWED | — |
| `public/assets/sr_open_sound.mp3` | binary asset | 44303 | UNREVIEWED | — |
| `public/assets/sr_overtime_sound.mp3` | binary asset | 63529 | UNREVIEWED | — |
| `public/css/military-glass-terminal.css` | CSS | 115607 | UNREVIEWED | — |
| `public/gate-build-2-sw.js` | configuration | 1282 | UNREVIEWED | — |
| `public/index.html` | HTML | 95326 | UNREVIEWED | — |
| `public/js/gate-access-control-controller.js` | legacy/runtime JS | 14728 | UNREVIEWED | — |
| `public/js/gate-airman-modal-close-safety.js` | legacy/runtime JS | 4845 | UNREVIEWED | — |
| `public/js/gate-airport-bus-delete-controller.js` | legacy/runtime JS | 9277 | UNREVIEWED | — |
| `public/js/gate-airport-phone-layout-fix.js` | legacy/runtime JS | 5788 | UNREVIEWED | — |
| `public/js/gate-app-shell-controller.js` | legacy/runtime JS | 21302 | UNREVIEWED | — |
| `public/js/gate-archive-controller.js` | legacy/runtime JS | 63354 | UNREVIEWED | — |
| `public/js/gate-archive-print-controller.js` | legacy/runtime JS | 10254 | UNREVIEWED | — |
| `public/js/gate-branding-controller.js` | legacy/runtime JS | 6057 | UNREVIEWED | — |
| `public/js/gate-bus-workflow-controller.js` | legacy/runtime JS | 25442 | UNREVIEWED | — |
| `public/js/gate-component-contracts.js` | legacy/runtime JS | 10169 | UNREVIEWED | — |
| `public/js/gate-desktop-nav-restore.js` | legacy/runtime JS | 13433 | UNREVIEWED | — |
| `public/js/gate-fullscreen-board-layout-controller.js` | legacy/runtime JS | 3126 | UNREVIEWED | — |
| `public/js/gate-input-page-controller.js` | legacy/runtime JS | 35040 | UNREVIEWED | — |
| `public/js/gate-mobile-app-shell-finalizer.js` | legacy/runtime JS | 11535 | UNREVIEWED | — |
| `public/js/gate-mobile-nav-routing-fix.js` | legacy/runtime JS | 6734 | UNREVIEWED | — |
| `public/js/gate-mobile-shell-redesign.js` | legacy/runtime JS | 18669 | UNREVIEWED | — |
| `public/js/gate-permission-guard.js` | legacy/runtime JS | 10014 | UNREVIEWED | — |
| `public/js/gate-persistence-runtime.js` | legacy/runtime JS | 15283 | UNREVIEWED | — |
| `public/js/gate-premium-metrics-controller.js` | legacy/runtime JS | 5287 | UNREVIEWED | — |
| `public/js/gate-processing-controller.js` | legacy/runtime JS | 34703 | UNREVIEWED | — |
| `public/js/gate-processing-final-time-commit.js` | legacy/runtime JS | 9151 | UNREVIEWED | — |
| `public/js/gate-record-display-contract.js` | legacy/runtime JS | 3325 | UNREVIEWED | — |
| `public/js/gate-render-stability-fix.js` | legacy/runtime JS | 878 | UNREVIEWED | — |
| `public/js/gate-squadron-access-gate.js` | legacy/runtime JS | 3641 | UNREVIEWED | — |
| `public/js/gate-status-board-controller.js` | legacy/runtime JS | 21962 | UNREVIEWED | — |
| `public/js/gate-status-board-shadow-controller.js` | legacy/runtime JS | 6248 | UNREVIEWED | — |
| `public/js/gate-status-board-timer-visual-stability.js` | legacy/runtime JS | 3133 | UNREVIEWED | — |
| `public/js/gate-tablet-processing-modal-fix.js` | legacy/runtime JS | 6672 | UNREVIEWED | — |
| `public/js/gate-tablet-shell-classifier.js` | legacy/runtime JS | 1319 | UNREVIEWED | — |
| `public/js/gate-ui-hooks.js` | legacy/runtime JS | 19672 | UNREVIEWED | — |
| `public/js/prc-dash-access-control-validation.js` | legacy/runtime JS | 1094 | UNREVIEWED | — |
| `public/js/prc-dash-archive-actions.js` | legacy/runtime JS | 19000 | UNREVIEWED | — |
| `public/js/prc-dash-archive-print-cleanup.js` | legacy/runtime JS | 19542 | UNREVIEWED | — |
| `public/js/prc-dash-auditorium-location.js` | legacy/runtime JS | 13865 | UNREVIEWED | — |
| `public/js/prc-dash-board-header.js` | legacy/runtime JS | 1585 | UNREVIEWED | — |
| `public/js/prc-dash-current-summary-live-records.js` | legacy/runtime JS | 18014 | UNREVIEWED | — |
| `public/js/prc-dash-dorm-block-polish.js` | legacy/runtime JS | 12562 | UNREVIEWED | — |
| `public/js/prc-dash-dorm-final-time.js` | legacy/runtime JS | 9362 | UNREVIEWED | — |
| `public/js/prc-dash-dorm-flag-validation.js` | legacy/runtime JS | 11944 | UNREVIEWED | — |
| `public/js/prc-dash-dorm-reopen.js` | legacy/runtime JS | 17467 | UNREVIEWED | — |
| `public/js/prc-dash-final-audit.js` | legacy/runtime JS | 29118 | UNREVIEWED | — |
| `public/js/prc-dash-modal-mobile-validation.js` | legacy/runtime JS | 11427 | UNREVIEWED | — |
| `public/js/prc-dash-overtime-audit.js` | legacy/runtime JS | 10340 | UNREVIEWED | — |
| `public/js/prc-dash-print-report.js` | legacy/runtime JS | 19461 | UNREVIEWED | — |
| `public/js/prc-dash-processing-context-menu.js` | legacy/runtime JS | 15683 | UNREVIEWED | — |
| `public/js/prc-dash-processing-loaded-summary.js` | legacy/runtime JS | 5906 | UNREVIEWED | — |
| `public/js/prc-dash-receiving-summary-window-fix.js` | legacy/runtime JS | 18154 | UNREVIEWED | — |
| `public/js/prc-dash-runtime-fixes.js` | legacy/runtime JS | 7007 | UNREVIEWED | — |
| `public/js/prc-dash-sat-arrivals.js` | legacy/runtime JS | 15587 | UNREVIEWED | — |
| `public/js/prc-dash-space-force.js` | legacy/runtime JS | 8079 | UNREVIEWED | — |
| `public/login.html` | HTML | 454 | UNREVIEWED | — |
| `public/login/index.html` | HTML | 6302 | UNREVIEWED | — |
| `public/squadron/index.html` | HTML | 937 | UNREVIEWED | — |
| `schema.sql` | database | 759 | UNREVIEWED | — |
| `tests/build-2/accessibility/accessibility-foundation.test.mjs` | test | 7381 | UNREVIEWED | — |
| `tests/build-2/components/component-workshop.test.mjs` | test | 6577 | UNREVIEWED | — |
| `tests/build-2/data/canonical-entities.test.mjs` | test | 4759 | UNREVIEWED | — |
| `tests/build-2/data/record-normalization.test.mjs` | test | 6336 | UNREVIEWED | — |
| `tests/build-2/data/repositories.test.mjs` | test | 10860 | UNREVIEWED | — |
| `tests/build-2/design/gdl-foundations.test.mjs` | test | 2388 | UNREVIEWED | — |
| `tests/build-2/domain/dorm-identity.test.mjs` | test | 1428 | UNREVIEWED | — |
| `tests/build-2/domain/foundation-alignment-gate-a.test.mjs` | test | 7806 | UNREVIEWED | — |
| `tests/build-2/domain/operational-truth.test.mjs` | test | 6969 | UNREVIEWED | — |
| `tests/build-2/fixtures/B2-P1-F001-receiving-parity.json` | test | 12697 | UNREVIEWED | — |
| `tests/build-2/fixtures/B2-P1-F011-record-compatibility.json` | test | 2450 | UNREVIEWED | — |
| `tests/build-2/foundation/consolidated-foundation.test.mjs` | test | 8208 | UNREVIEWED | — |
| `tests/build-2/parity/phase-1e-parity.test.mjs` | test | 6125 | UNREVIEWED | — |
| `tests/build-2/responsive/fixtures/B2-P2-F002-postures.json` | test | 2155 | UNREVIEWED | — |
| `tests/build-2/responsive/responsive-composition.test.mjs` | test | 7815 | UNREVIEWED | — |
| `tests/build-2/server/archive-read-api.test.mjs` | test | 7549 | UNREVIEWED | — |
| `tests/build-2/server/flight-alert-six-column.test.mjs` | test | 3879 | UNREVIEWED | — |
| `tests/build-2/server/persistence-api.test.mjs` | test | 13466 | UNREVIEWED | — |
| `tests/build-2/server/persistence-audit.test.mjs` | test | 7587 | UNREVIEWED | — |
| `tests/build-2/server/persistence-rollback-integrity.test.mjs` | test | 2444 | UNREVIEWED | — |
| `tests/build-2/server/persistence-runtime.test.mjs` | test | 7890 | UNREVIEWED | — |
| `tests/build-2/server/records-api.test.mjs` | test | 11362 | UNREVIEWED | — |
| `tests/build-2/server/squadron-security.test.mjs` | test | 17640 | UNREVIEWED | — |
| `tests/build-2/shell/fixtures/B2-P2-F001-shell-parity.json` | test | 861 | UNREVIEWED | — |
| `tests/build-2/shell/unified-shell.test.mjs` | test | 9026 | UNREVIEWED | — |
| `tests/build-2/status-board-shadow/fixtures/B2-P3A-F001-route-readiness.json` | test | 1431 | UNREVIEWED | — |
| `tests/build-2/status-board-shadow/status-board-evidence-harness.test.mjs` | test | 4426 | UNREVIEWED | — |
| `tests/build-2/status-board-shadow/status-board-evidence-review.test.mjs` | test | 7674 | UNREVIEWED | — |
| `tests/build-2/status-board-shadow/status-board-shadow.test.mjs` | test | 13233 | UNREVIEWED | — |
| `tests/build-2/synchronization/synchronization-degraded-operation.test.mjs` | test | 10574 | UNREVIEWED | — |
| `tests/build-2/workflows/critical-workflows.test.mjs` | test | 18849 | UNREVIEWED | — |
| `tests/runtime/active-runtime-budget.test.mjs` | test | 5045 | UNREVIEWED | — |
| `tests/runtime/dorm-timer-record-lifecycle.test.mjs` | test | 2666 | UNREVIEWED | — |
| `tests/runtime/flight-alert-import.test.mjs` | test | 9670 | UNREVIEWED | — |
| `tests/runtime/full-system-integrity.test.mjs` | test | 10879 | UNREVIEWED | — |
| `tests/runtime/fullscreen-command-board-readability.test.mjs` | test | 3183 | UNREVIEWED | — |
| `tests/runtime/light-mode-contrast.test.mjs` | test | 1733 | UNREVIEWED | — |
| `tests/runtime/login-session-integrity.test.mjs` | test | 11199 | UNREVIEWED | — |
| `tests/runtime/mgt-color-hierarchy.test.mjs` | test | 4824 | UNREVIEWED | — |
| `tests/runtime/mgt-dark-mode-contrast.test.mjs` | test | 3899 | UNREVIEWED | — |
| `tests/runtime/operational-ui-audit-remediation.test.mjs` | test | 25601 | UNREVIEWED | — |
| `tests/runtime/processing-modal-record-persistence.test.mjs` | test | 7229 | UNREVIEWED | — |
| `tests/runtime/processing-save-button-layout.test.mjs` | test | 1394 | UNREVIEWED | — |
| `tests/runtime/record-display-integrity.test.mjs` | test | 13132 | UNREVIEWED | — |
| `tests/runtime/status-board-visual-stability.test.mjs` | test | 7838 | UNREVIEWED | — |
| `wrangler.jsonc` | configuration | 261 | UNREVIEWED | — |

## Change log

- Audit ledger created from the complete recursive Git tree before any cleanup deletion.
