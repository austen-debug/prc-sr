# GATE Active Runtime Stack

Status: Phase 1C updated baseline
Scope: Documents the active served runtime after App Shell, Status Board metric, and Status Board body ownership consolidation.

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
10. `/js/prc-dash-dorm-flag-validation.js`
11. `/js/prc-dash-auditorium-location.js`
12. `/js/prc-dash-processing-context-menu.js`
13. `/js/gate-processing-final-time-commit.js?v=final-time-commit-20260707`
14. `/js/gate-airman-modal-close-safety.js?v=airman-modal-close-20260707`
15. `/js/gate-bus-workflow-controller.js`
16. `/js/prc-dash-print-report.js`
17. `/js/gate-input-page-controller.js`
18. `/js/prc-dash-archive-actions.js`
19. `/js/prc-dash-archive-print-cleanup.js`
20. `/js/gate-permission-guard.js?v=phase-1a-permission-guard-20260709`
21. `/js/gate-app-shell-controller.js?v=phase-1a-app-shell-20260709`
22. `/js/prc-dash-modal-mobile-validation.js`
23. `/js/gate-tablet-processing-modal-fix.js?v=tablet-processing-modal-20260707`
24. `/js/gate-airport-phone-layout-fix.js?v=airport-phone-hard-fix-20260707`
25. `/js/gate-render-stability-fix.js?v=render-stability-20260707`
26. `/js/prc-dash-processing-loaded-summary.js`
27. `/js/prc-dash-current-summary-live-records.js`
28. `/js/gate-archive-print-controller.js`
29. `/js/gate-premium-metrics-controller.js?v=premium-metrics-20260709d`
30. `/js/prc-dash-overtime-audit.js`

## Removed from active runtime in Phase 1A

These files remain in the repository for traceability but are no longer loaded by middleware:

1. `/js/prc-dash-access-control-validation.js`
2. `/js/gate-mobile-nav-routing-fix.js?v=mobile-nav-routing-20260707`
3. `/js/gate-mobile-shell-redesign.js?v=mobile-shell-redesign-20260707b`
4. `/js/gate-mobile-app-shell-finalizer.js?v=mobile-app-shell-finalizer-20260707`
5. `/js/gate-desktop-nav-restore.js?v=desktop-nav-restore-20260707`

## Runtime pattern after Phase 1C

The runtime is still a monolithic base app plus injected controllers, but the largest board surfaces now have active owners.

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

`GateStatusBoardController` is now the active owner for:

- Status Board dorm columns
- Status Board dorm card rendering handoff
- Active Buses En Route panel
- board timer text refresh
- legacy `renderDormColumns` / `buildBoardDormCard` compatibility functions

`prc-dash-final-audit.js` has been narrowed to:

- document identity support
- Squadron Board creation/rendering
- close-dorm final-time safety
- compatibility `GateDormBoardController` API

## Remaining high-risk active overlap areas

1. Processing page / modal
   - `index.html`
   - `prc-dash-processing-context-menu.js`
   - `gate-processing-final-time-commit.js`
   - `gate-airman-modal-close-safety.js`
   - `gate-tablet-processing-modal-fix.js`
   - `prc-dash-modal-mobile-validation.js`

2. Bus workflow
   - `index.html`
   - `gate-bus-workflow-controller.js`
   - Status Board active bus panel now reads these records, but does not create them.

3. Input / initialization
   - `index.html`
   - `gate-input-page-controller.js`

4. Archive / reporting
   - `gate-ui-hooks.js` archive schema controller
   - `prc-dash-archive-actions.js`
   - `prc-dash-archive-print-cleanup.js`
   - `gate-archive-print-controller.js`
   - `prc-dash-current-summary-live-records.js`

5. Mobile page-specific patches
   - `gate-airport-phone-layout-fix.js`
   - `prc-dash-modal-mobile-validation.js`
   - `gate-tablet-processing-modal-fix.js`

## Phase 1C conclusion

Navigation / App Shell / Mobile Shell, Status Board metrics, Status Board dorm columns, and Active Buses En Route now have active canonical owners. The next recommended phase is Processing page and modal ownership consolidation.
