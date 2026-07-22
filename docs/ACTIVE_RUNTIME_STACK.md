# GATE Active Runtime Stack

Status: Phase 3A Status Board shadow active; Audit Remediation Gate 1 complete; Gate 2 next  
Scope: authoritative served-runtime order from `functions/_middleware.js`

## Purpose

The active GATE application is not defined only by `public/index.html`. Cloudflare Functions middleware injects and source-refactors the CSS and JavaScript layers used by authenticated pages. This register identifies the active order, operational ownership, the narrow Phase 3A shadow boundary, and the enforced runtime-growth ceiling.

## Active asset totals

```text
Direct stylesheets: 13
Imported stylesheets: 3
Direct scripts: 27
Visible Build 2 routes: 0
Hidden Build 2 runtime observers: 1
```

The machine-readable inventory and ceilings are governed by `docs/build-2/ACTIVE_RUNTIME_BUDGET.json` and validated by `tests/runtime/active-runtime-budget.test.mjs`.

## Active CSS load path

Injected directly by middleware in current order:

1. `/css/gate-index-legacy-shell.css`
2. `/css/gate-base-tokens.css`
3. `/css/gate-layout-pages.css`
4. `/css/gate-components.css`
5. `/css/gate-utilities-access.css?v=status-board-stable-surfaces-20260721`
6. `/css/gate-premium-metrics.css?v=status-board-fluid-metrics-20260721`
7. `/css/gate-app-shell.css?v=phase-7g-viewport-watermark-20260709`
8. `/css/gate-mobile-corrective.css?v=phase-7h-ui-patch-retirement-20260709`
9. `/css/gate-ui-ownership-correction.css?v=operational-ui-audit-20260721`
10. `/css/gate-light-mode-command-contrast.css?v=light-command-contrast-20260714`
11. `/css/gate-light-mode-grid-correction.css?v=light-grid-correction-20260714`
12. `/css/gate-tablet-shell.css?v=tablet-shell-20260714`
13. `/css/gate-fullscreen-board-contract.css?v=fullscreen-compact-bus-tiles-20260721`

Imported through the active utility chain:

- `/css/gate-board-presentation.css?v=status-board-light-clarity-20260714`
- `/css/gate-theme-unified-contract.css`
- `/css/gate-clean-ui-pass.css`

## Active JavaScript load path

Injected by middleware in current order:

1. `/js/gate-record-display-contract.js?v=record-display-integrity-20260714b`
2. `/js/gate-component-contracts.js`
3. `/js/gate-ui-hooks.js?v=phase-6-hooks-20260709`
4. `/js/gate-branding-controller.js`
5. `/js/prc-dash-runtime-fixes.js?v=phase-8e-runtime-safeguards-20260709`
6. `/js/prc-dash-sat-arrivals.js`
7. `/js/prc-dash-space-force.js`
8. `/js/prc-dash-dorm-reopen.js`
9. `/js/prc-dash-final-audit.js?v=record-display-integrity-20260714`
10. `/js/gate-status-board-controller.js?v=status-board-incremental-render-20260721`
11. `/js/gate-processing-controller.js?v=record-display-integrity-20260714`
12. `/js/prc-dash-dorm-flag-validation.js?v=record-display-integrity-20260714b`
13. `/js/prc-dash-auditorium-location.js?v=processing-modal-record-binding-20260721`
14. `/js/gate-bus-workflow-controller.js?v=phase-3-bus-workflow-20260709`
15. `/js/gate-airport-bus-delete-controller.js?v=airport-bus-delete-20260714`
16. `/js/gate-input-page-controller.js?v=record-display-integrity-20260714`
17. `/js/gate-archive-controller.js?v=phase-8c-report-wording-20260709`
18. `/js/gate-permission-guard.js?v=phase-1a-permission-guard-20260709`
19. `/js/gate-tablet-shell-classifier.js?v=tablet-shell-20260714`
20. `/js/gate-app-shell-controller.js?v=phase-7g-viewport-watermark-20260709`
21. `/js/gate-fullscreen-board-layout-controller.js?v=fullscreen-board-containment-20260714b`
22. `/js/prc-dash-modal-mobile-validation.js?v=phase-7e-ui-ownership-20260709`
23. `/js/gate-render-stability-fix.js?v=status-board-compositing-retired-20260721`
24. `/js/prc-dash-processing-loaded-summary.js`
25. `/js/gate-premium-metrics-controller.js?v=metric-live-clock-20260722`
26. `/js/prc-dash-overtime-audit.js`
27. `/js/gate-status-board-shadow-controller.js?v=phase-3a-status-board-shadow-20260715`

## Operational owners

- `GateHooks` owns lifecycle hook registration and the `renderAll()` / `showPage()` wrappers.
- `GateAppShell` owns visible route state, role-aware navigation, drawer/sheet behavior, and Week Group shell context.
- `GatePermissionGuard` owns client-side action protection; server authorization remains authoritative.
- `GateStatusBoardController` owns the visible Status Board dorm columns, dorm cards, active-bus panel, timer text, warning/critical timer state, direct-surface integrity repair, and per-column incremental rendering.
- `GatePremiumMetricsController` owns change-only synchronization of Arrived, Expected, Last, and Local values. The Local clock is second-aligned, displays `HH:MM:SS`, resumes immediately after visibility/focus/fullscreen transitions, and updates only the `#stat-local` text node.
- `GateProcessingController` owns Processing page rendering, dorm-modal lifecycle, and all dorm-record mutations.
- `GateAuditoriumLocationController` owns field hydration and card augmentation for Auditorium Location. It binds the modal field to the active dorm ID and delegates persistence through `GateProcessingController.updateDorm`; it does not call the Data SDK directly.
- `GateBusWorkflowController` owns airport and local-arrival bus workflows.
- `GateInputPageController` owns Input and Week Group initialization presentation.
- `GateArchiveController` owns Archives, reporting, print/PDF, and closeout presentation.

The former `GateStatusBoardTimerVisualStability` corrective layer remains retired. Timer state is consolidated into `GateStatusBoardController`. The Status Board is also excluded from the runtime-injected forced-compositing rules in `gate-render-stability-fix.js`; stable board surfaces and timer geometry are now static CSS contracts.

The served legacy `renderAll()` path delegates Active Buses and dorm columns to `GateStatusBoardController` whenever the canonical owner is available. The legacy Local clock interval is removed at serve time so `GatePremiumMetricsController` is the only live clock owner. The legacy timer fallback uses steady warning/critical states without `timer-flash`.

## Phase 3A hidden observer

`gate-status-board-shadow-controller.js` is active only as a hidden, read-only observer.

It may:

- read the same in-memory `allData` record list;
- read the active Week Group;
- capture visible Build 1 Status Board metrics and rendered timer presentation;
- import `/app/status-board-shadow/index.mjs`;
- run canonical comparison after lifecycle hooks and on a 30-second cadence;
- retain aggregate comparison evidence in memory;
- expose frozen diagnostics at `window.GateStatusBoardShadow`.

It may not:

- create or expose a visible route;
- replace or modify Status Board markup;
- call an API;
- create, update, or delete a record;
- persist evidence in browser storage;
- queue a write;
- register a service worker;
- supersede `GateStatusBoardController` or any other Build 1 owner.

## Build 2 runtime boundary

Only the narrow Phase 3A bridge is injected. The following remain staged and are not directly loaded as visible application owners by middleware:

- Build 2 shell and route host;
- Build 2 components and page renderers;
- Build 2 write workflows;
- Build 2 synchronization service as an operational data owner;
- Build 2 service worker;
- Processing, Airport, Input, Archives, and Squadron Build 2 routes;
- fixture evidence harness and evidence-retention utilities.

The shadow bridge dynamically imports only the pure Status Board shadow package after authenticated page load.

## Runtime-bloat controls

The current counts are ceilings, not targets.

- A normal pull request may not increase direct or imported active assets.
- No new active asset may be named or scoped as a fix, patch, corrective layer, restore layer, finalizer, cleanup layer, or stability layer.
- Any active-asset change must update this register and `ACTIVE_RUNTIME_BUDGET.json` in the same pull request.
- A visible Phase 3B route must be net-negative and meet the retirement targets in `STATUS_BOARD_RETIREMENT_MANIFEST.md`.
- Build 2 evidence, fixtures, and review tooling remain outside active middleware and routing.

## Status Board retirement boundary

Phase 3B must not add a second visible owner on top of the existing Status Board stack. The activation package must remove the legacy Status Board controllers, corrective presentation layers, middleware source rewrites, compatibility globals, and the Phase 3A shadow observer identified in `docs/build-2/STATUS_BOARD_RETIREMENT_MANIFEST.md`.

Target after accepted Status Board activation:

```text
Direct stylesheets: 12 or fewer
Imported stylesheets: 3 or fewer
Direct scripts: 24 or fewer
New corrective assets: 0
Visible Status Board owners: 1
Middleware Status Board source rewrites: 0
```

## Historical continuity

Earlier ownership consolidation, removed patch files, and page-specific migrations remain documented in the phase reports under `docs/`. Git history retains the prior expanded runtime register. This document governs the current served order when those earlier reports conflict with present middleware.

## Current acceptance state

```text
PASS — active middleware order documented
PASS — machine-readable active asset inventory established
PASS — Build 1 visible owners retained
PASS — one canonical Status Board timer and direct-surface integrity owner
PASS — Status Board column writes are incremental by state
PASS — live metrics use change-only synchronization
PASS — Local clock has one second-aligned `HH:MM:SS` owner
PASS — Status Board forced GPU compositing retired
PASS — Processing assignment/location saves are bound to the active dorm record
PASS — Processing Auditorium Location persistence delegates to the canonical dorm mutation owner
PASS — modal layers remain above phone and tablet shell layers
PASS — Processing modal reachability covers coarse-pointer tablets through 1366 px
PASS — narrow fine-pointer desktops retain a fixed single-row navigation shell
PASS — fullscreen Active Bus cards are bounded compact tiles with versioned delivery
PASS — one hidden Phase 3A bridge loaded after the visible Status Board owner
PASS — runtime record-integrity workflow
PASS — no visible Build 2 route
PASS — no Build 2 production write path
PASS — active asset growth blocked below the audited ceiling

PENDING — sustained live shadow evidence
PENDING — manual route accessibility, responsive, and fullscreen evidence
PENDING — external deployment and rollback verification
PENDING — Status Board legacy owner retirement
NOT AUTHORIZED — Phase 3B controlled test surface
NOT AUTHORIZED — Build 1 Status Board retirement
```
