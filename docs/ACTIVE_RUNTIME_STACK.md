# GATE Active Runtime Stack

Status: Phase 4 updated baseline
Scope: Documents the active served runtime after App Shell, Status Board, Processing, Airport/local arrival, and Input/Week Group initialization ownership consolidation.

## Purpose

This document identifies the active served runtime stack for GATE — Gateway Arrival Tracking Environment. The active app is not defined only by `public/index.html`; it is defined by `functions/_middleware.js`, which injects and source-refactors the live CSS and JavaScript layers into served HTML.

## Active CSS load path

Injected directly by middleware:

1. `/css/gate-index-legacy-shell.css`
2. `/css/gate-base-tokens.css`
3. `/css/gate-layout-pages.css`
4. `/css/gate-components.css`
5. `/css/gate-utilities-access.css`
6. `/css/gate-premium-metrics.css?v=premium-metrics-20260709d`
7. `/css/gate-app-shell.css?v=phase-1a-app-shell-20260709`

Imported by `gate-utilities-access.css`:

1. `/css/gate-board-presentation.css`
2. `/css/gate-theme-unified-contract.css`
3. `/css/gate-clean-ui-pass.css`
4. `/css/gate-mobile-ui-polish.css`

Legacy / important note:

- `public/index.html` still contains substantial inline CSS and original shell layout rules.
- Some CSS is also injected dynamically by JavaScript controllers.
- `gate-app-shell.css` is the final active CSS owner for app shell/nav/page isolation presentation.
- `gate-premium-metrics.css` is the active component style layer for the canonical four-card Status Board metric row.

## Active JavaScript load path

Injected by middleware in current order:

1. `/js/gate-component-contracts.js`
2. `/js/gate-ui-hooks.js`
3. `/js/gate-branding-controller.js`
4. `/js/prc-dash-runtime-fixes.js`
5. `/js/prc-dash-sat-arrivals.js`
6. `/js/prc-dash-space-force.js`
7. `/js/prc-dash-dorm-reopen.js`
8. `/js/prc-dash-final-audit.js`
9. `/js/gate-status-board-controller.js?v=phase-1c-status-board-20260709`
10. `/js/gate-processing-controller.js?v=phase-2-processing-20260709b`
11. `/js/prc-dash-dorm-flag-validation.js`
12. `/js/prc-dash-auditorium-location.js`
13. `/js/gate-bus-workflow-controller.js?v=phase-3-bus-workflow-20260709`
14. `/js/prc-dash-print-report.js`
15. `/js/gate-input-page-controller.js?v=phase-4-input-20260709`
16. `/js/prc-dash-archive-actions.js`
17. `/js/prc-dash-archive-print-cleanup.js`
18. `/js/gate-permission-guard.js?v=phase-1a-permission-guard-20260709`
19. `/js/gate-app-shell-controller.js?v=phase-1a-app-shell-20260709`
20. `/js/prc-dash-modal-mobile-validation.js`
21. `/js/gate-tablet-processing-modal-fix.js?v=tablet-processing-modal-20260707`
22. `/js/gate-airport-phone-layout-fix.js?v=airport-phone-hard-fix-20260707`
23. `/js/gate-render-stability-fix.js?v=render-stability-20260707`
24. `/js/prc-dash-processing-loaded-summary.js`
25. `/js/prc-dash-current-summary-live-records.js`
26. `/js/gate-archive-print-controller.js`
27. `/js/gate-premium-metrics-controller.js?v=premium-metrics-20260709d`
28. `/js/prc-dash-overtime-audit.js`

## Removed from active runtime in Phase 1A

These files remain in the repository for traceability but are no longer loaded by middleware:

1. `/js/prc-dash-access-control-validation.js`
2. `/js/gate-mobile-nav-routing-fix.js?v=mobile-nav-routing-20260707`
3. `/js/gate-mobile-shell-redesign.js?v=mobile-shell-redesign-20260707b`
4. `/js/gate-mobile-app-shell-finalizer.js?v=mobile-app-shell-finalizer-20260707`
5. `/js/gate-desktop-nav-restore.js?v=desktop-nav-restore-20260707`

## Removed from active runtime in Phase 2

These files remain in the repository for traceability but are no longer loaded by middleware:

1. `/js/prc-dash-processing-context-menu.js`
2. `/js/gate-processing-final-time-commit.js?v=final-time-commit-20260707`
3. `/js/gate-airman-modal-close-safety.js?v=airman-modal-close-20260707`

## Runtime pattern after Phase 4

The runtime is still a monolithic base app plus injected controllers, but the major operational workflow surfaces now have active owners.

`GateAppShell` is the final active owner for:

- `showPage`
- `buildNav`
- role-aware nav rendering
- page isolation
- mobile drawer state
- moving system controls into/out of the mobile drawer
- Week Group chip display

`GatePermissionGuard` is responsible for:

- protected action guards
- instructor-only form blocking
- Squadron limited interaction blocking
- Airman allowed local arrival support
- non-instructor context-menu blocking

Status Board metrics are served as source-owned markup by middleware:

- `stat-arrived`
- `stat-expected`
- `stat-last`
- `stat-local`

The served base runtime writes directly to those IDs. `gate-premium-metrics-controller.js` is now a passive sync/cleanup guard only, not a card-creation layer.

`GateStatusBoardController` is the active owner for:

- Status Board dorm columns
- Status Board dorm card rendering handoff
- Active Buses En Route panel
- board timer text refresh
- legacy `renderDormColumns` / `buildBoardDormCard` compatibility functions

`GateProcessingController` is the active owner for:

- Processing dorm card rendering
- Processing dorm modal open/close
- Airman-safe modal close behavior
- assigned Airman save
- load save
- phase update
- open dorm
- close dorm
- reopen dorm
- instructor edit modal workflow
- final-time edit commit
- Processing instructor context menu
- legacy Processing global compatibility functions

`GateBusWorkflowController` is the active owner for:

- airport bus form submission
- local arrival form submission
- active bus arrival confirmation
- airport/local bus edit modal open/close
- local bus modal open/close
- combined airport/local bus log rendering
- Space Force bus fields and table column
- bus-related surface refresh after create/update/arrival confirmation
- legacy airport/local bus global compatibility functions

`GateInputPageController` is the active owner for:

- batch grid rendering
- batch row state
- clear row behavior
- horizontal tab flow
- Total Expected calculation
- Week Group initialization
- receiving Day One / Day Two windows
- Space Force dorm checkbox column
- Band / Space Force mutual exclusion
- dorm payload validation before create
- receiving-window and Space Force metadata injection into dorm/archive payloads
- legacy Input global compatibility functions

`prc-dash-final-audit.js` has been narrowed to:

- document identity support
- Squadron Board creation/rendering
- close-dorm final-time safety compatibility
- compatibility `GateDormBoardController` API

## Remaining high-risk active overlap areas

1. Archive / reporting
   - `gate-ui-hooks.js` archive schema controller
   - `prc-dash-archive-actions.js`
   - `prc-dash-archive-print-cleanup.js`
   - `gate-archive-print-controller.js`
   - `prc-dash-current-summary-live-records.js`

2. Mobile page-specific patches
   - `gate-airport-phone-layout-fix.js`
   - `prc-dash-modal-mobile-validation.js`
   - `gate-tablet-processing-modal-fix.js`

## Phase 4 conclusion

Navigation / App Shell / Mobile Shell, Status Board metrics, Status Board dorm columns, Active Buses En Route, Processing page/modal behavior, Airport/local arrival bus workflow, and Input / Week Group initialization now have active canonical owners. The next recommended phase is Archive / Reporting / Closeout consolidation.
