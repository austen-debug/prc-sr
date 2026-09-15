# GATE Active Runtime Stack

Status: Phase 3A Status Board shadow active; CSS infrastructure consolidated; Audit Remediation Gate 1 complete  
Scope: authoritative served-runtime order from `functions/_middleware.js`

## Purpose

The active GATE application is not defined only by `public/index.html`. Cloudflare Functions middleware injects and source-refactors the CSS and JavaScript layers used by authenticated pages. This register identifies the active order, operational ownership, the narrow Phase 3A shadow boundary, and the enforced runtime-growth ceiling.

## Active asset totals

```text
Direct stylesheets: 1
Imported stylesheets: 0
Direct scripts: 27
Visible Build 2 routes: 0
Hidden Build 2 runtime observers: 1
```

The machine-readable inventory and ceilings are governed by `docs/build-2/ACTIVE_RUNTIME_BUDGET.json` and validated by `tests/runtime/active-runtime-budget.test.mjs`.

## Active CSS load path

Middleware now injects one stylesheet and no stylesheet imports:

1. `/css/military-glass-terminal.css?v=military-glass-terminal-20260915-darkcontrast1`

`public/css/military-glass-terminal.css` is the production visual source of truth for tokens, light/dark themes, shell geometry, page spacing, Status/Squadron boards, Processing, Airport, Input, Archives, login, modal geometry, responsive behavior, fullscreen behavior, skeleton geometry, z-index bands, and interaction motion.

The former multi-file CSS stack and its corrective/import cascade are retired from the production filesystem. New visual changes must extend the canonical asset rather than restore a stylesheet graph or priority-lock cascade.

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
10. `/js/gate-status-board-controller.js?v=dorm-timer-record-lifecycle-20260722`
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
- `GateStatusBoardController` owns the visible Status Board dorm columns, dorm cards, active-bus panel, elapsed-time calculation, record-bound timer text, warning/critical timer state, direct-surface integrity repair, and per-column incremental rendering. It rebinds every open timer to the current dorm record before each second-aligned tick and publishes the same elapsed-time function to the Processing open/close workflow.
- `GatePremiumMetricsController` owns change-only synchronization of Arrived, Expected, Last, and Local values. The Local clock is second-aligned, displays `HH:MM:SS`, resumes immediately after visibility/focus/fullscreen transitions, and updates only the `#stat-local` text node.
- `GateProcessingController` owns Processing page rendering, dorm-modal lifecycle, and all dorm-record mutations. Open writes `opened_at`; Close derives `closed_timer` from that timestamp through the canonical elapsed-time function; Reopen reconstructs `opened_at` from the retained final time.
- `GateAuditoriumLocationController` owns field hydration and card augmentation for Auditorium Location. It binds the modal field to the active dorm ID and delegates persistence through `GateProcessingController.updateDorm`; it does not call the Data SDK directly.
- `GateBusWorkflowController` owns airport and local-arrival bus workflows.
- `GateInputPageController` owns Input and Week Group initialization presentation.
- `GateArchiveController` owns Archives, reporting, print/PDF, and closeout presentation.

`prc-dash-modal-mobile-validation.js` and the legacy Status-header compatibility path no longer create stylesheet requests. They reuse the canonical CSS asset while retaining their existing lifecycle and interaction behavior.

The served legacy `renderAll()` path delegates Active Buses and dorm columns to `GateStatusBoardController` whenever the canonical owner is available. The legacy Local clock interval is removed at serve time so `GatePremiumMetricsController` is the only live clock owner. The legacy timer callback is rebound to the canonical elapsed-time and tick functions and uses steady warning/critical states without `timer-flash`.

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

Only the narrow Phase 3A bridge is injected. Build 2 shell/routes, write workflows, synchronization ownership, service worker, and fixture/evidence tooling remain staged and are not directly loaded as visible application owners by middleware.

## Runtime-bloat controls

The production CSS budget is now fixed at one direct stylesheet and zero imported stylesheets.

- A normal pull request may not add another active stylesheet or import.
- No new active asset may be named or scoped as a fix, patch, corrective layer, restore layer, finalizer, cleanup layer, or stability layer.
- Any active-asset change must update this register and `ACTIVE_RUNTIME_BUDGET.json` in the same pull request.
- Build 2 evidence, fixtures, and review tooling remain outside active middleware and routing.

## Current acceptance state

```text
PASS — one canonical production stylesheet
PASS — zero active stylesheet imports
PASS — canonical CSS contains no priority-lock declarations
PASS — active middleware order documented
PASS — machine-readable active asset inventory established
PASS — Build 1 visible owners retained
PASS — one canonical Status Board timer and direct-surface integrity owner
PASS — open dorm timers are rebound to authoritative records every second
PASS — close final time is derived from the persisted open timestamp
PASS — Status Board column writes are incremental by state
PASS — live metrics use change-only synchronization
PASS — Local clock has one second-aligned HH:MM:SS owner
PASS — Processing assignment/location saves are bound to the active dorm record
PASS — Processing Auditorium Location persistence delegates to the canonical dorm mutation owner
PASS — canonical z-index bands place modals above shell/popover layers
PASS — responsive 3-column / 2-column / 1-column grid matrix present
PASS — fullscreen Active Bus cards remain bounded compact tiles
PASS — one hidden Phase 3A bridge loaded after the visible Status Board owner
PASS — no visible Build 2 route
PASS — no Build 2 production write path

PENDING — sustained live shadow evidence
PENDING — manual route accessibility, responsive, and fullscreen evidence
PENDING — external deployment and rollback verification
PENDING — Status Board legacy owner retirement
NOT AUTHORIZED — Phase 3B controlled test surface
NOT AUTHORIZED — Build 1 Status Board retirement
```

## Historical continuity

Earlier ownership consolidation, removed patch files, and page-specific migrations remain documented in the phase reports under `docs/`. Git history retains the prior expanded CSS stack. This document governs the current served runtime when those earlier reports conflict with present middleware.
