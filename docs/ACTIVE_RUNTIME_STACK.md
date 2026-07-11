# GATE Active Runtime Stack

Status: Phase 7E updated baseline
Scope: Documents the active served runtime after workflow ownership consolidation and UI ownership correction.

## Purpose

This document identifies the active served runtime stack for GATE — Gateway Arrival Tracking Environment. The active app is not defined only by `public/index.html`; it is defined by `functions/_middleware.js`, which injects and source-refactors the live CSS and JavaScript layers into served HTML.

## Active CSS load path

Injected directly by middleware:

1. `/css/gate-index-legacy-shell.css`
2. `/css/gate-base-tokens.css`
3. `/css/gate-layout-pages.css`
4. `/css/gate-components.css`
5. `/css/gate-utilities-access.css?v=phase-7c-mobile-corrective-20260709`
6. `/css/gate-premium-metrics.css?v=premium-metrics-20260709d`
7. `/css/gate-app-shell.css?v=phase-7d-mobile-sheet-20260709`
8. `/css/gate-mobile-corrective.css?v=phase-7d-mobile-sheet-20260709`
9. `/css/gate-ui-ownership-correction.css?v=phase-7e-ui-ownership-20260709`

Imported by `gate-utilities-access.css`:

1. `/css/gate-board-presentation.css`
2. `/css/gate-theme-unified-contract.css`
3. `/css/gate-clean-ui-pass.css`

Important note: `gate-mobile-ui-polish.css` remains in the repository for traceability, but it is no longer imported by the active utility stylesheet.

## Active JavaScript load path

Injected by middleware in current order:

1. `/js/gate-component-contracts.js`
2. `/js/gate-ui-hooks.js?v=phase-6-hooks-20260709`
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
14. `/js/gate-input-page-controller.js?v=phase-4-input-20260709`
15. `/js/gate-archive-controller.js?v=phase-5-archive-20260709`
16. `/js/gate-permission-guard.js?v=phase-1a-permission-guard-20260709`
17. `/js/gate-app-shell-controller.js?v=phase-7d-mobile-sheet-20260709`
18. `/js/prc-dash-modal-mobile-validation.js?v=phase-7e-ui-ownership-20260709`
19. `/js/gate-tablet-processing-modal-fix.js?v=tablet-processing-modal-20260707`
20. `/js/gate-airport-phone-layout-fix.js?v=airport-phone-hard-fix-20260707`
21. `/js/gate-render-stability-fix.js?v=phase-7b-style-guard-20260709`
22. `/js/prc-dash-processing-loaded-summary.js`
23. `/js/gate-premium-metrics-controller.js?v=premium-metrics-20260709d`
24. `/js/prc-dash-overtime-audit.js`

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

## Removed from active runtime in Phase 5

These files remain in the repository for traceability but are no longer loaded by middleware:

1. `/js/prc-dash-archive-actions.js`
2. `/js/prc-dash-archive-print-cleanup.js`
3. `/js/prc-dash-current-summary-live-records.js`
4. `/js/gate-archive-print-controller.js`

## Removed from active runtime in Phase 6B

This file remains in the repository for traceability but is no longer loaded by middleware:

1. `/js/prc-dash-print-report.js`

Reason: `GateArchiveController` is now the only active owner for archive print/PDF and current summary print.

## Narrowed in Phase 6

`/js/gate-ui-hooks.js` remains active, but it is lifecycle-only.

It owns:

- hook registry initialization
- `window.runGateHooks()`
- `window.registerGateHook()`
- `window.unregisterGateHook()`
- `renderAll()` lifecycle wrapper
- `showPage()` lifecycle wrapper
- compatibility handoff stubs for prior installer calls

It no longer owns:

- Active Bus rendering
- Active Bus mutation observation
- Archive schema construction
- Safe closeout
- Closeout button ownership

## Narrowed in Phase 7B

`/js/gate-render-stability-fix.js` remains active, but it is style-only.

It owns:

- desktop-only board/processing visual stabilization CSS
- desktop-only watermark stabilization for board/processing pages

It no longer owns:

- `.page.active` mutation
- page visibility detection
- mutation observation
- document click handling
- document mousemove handling
- lifecycle hook subscriptions

## Narrowed in Phase 7E

`/js/prc-dash-modal-mobile-validation.js` remains active, but it is now a modal/touch helper only.

It owns:

- `gate-modal-open` body state
- `gate-touch-access-mode` body state
- Processing card long-press context-menu dispatch for instructor touch devices
- modal/touch state refresh

It no longer owns:

- board CSS
- watermark CSS
- fullscreen board CSS
- Airport page mobile layout CSS
- dorm modal visual CSS
- active-bus card CSS
- broad runtime style injection
- navigation/menu behavior

`/css/gate-ui-ownership-correction.css` is active as the final UI ownership boundary for:

- hiding phone-only sheet/scrim artifacts outside mobile drawer state
- desktop guard against accidental phone sheet display
- suppressing legacy `body::before` app watermark
- centering page-level watermarks behind board-style content

## Runtime pattern after Phase 7E

The runtime is still a monolithic base app plus injected controllers, but the major operational workflow surfaces now have active owners and UI ownership boundaries.

`GateHooks` / `gate-ui-hooks.js` is the active owner for lifecycle hook registration/execution and wrapping base `renderAll()` and `showPage()`.

`GateAppShell` is the active owner for:

- `showPage`
- `buildNav`
- `.page.active` state
- role-aware nav rendering
- page isolation
- mobile drawer state
- mobile drawer scrim/backdrop state
- mobile pointer/touch routing and synthetic-click suppression
- moving system controls into/out of the mobile drawer/sheet
- Week Group chip display

`GatePermissionGuard` is responsible for role/action protection.

`GateStatusBoardController` owns Status Board dorm columns, dorm cards, active bus panel, and board timer text refresh.

`GateProcessingController` owns Processing page/modal behavior.

`GateBusWorkflowController` owns airport/local arrival bus workflow.

`GateInputPageController` owns Input / Week Group initialization.

`GateArchiveController` owns Archive / Reporting / Closeout.

`GateRenderStabilityStyleGuard` is a style-only guard for desktop Status Board / Processing visual stability.

`gate-ui-ownership-correction.css` owns final UI artifact hiding and page-level watermark boundaries.

`prc-dash-final-audit.js` has been narrowed to document identity support, Squadron Board rendering, close-dorm final-time safety compatibility, and compatibility `GateDormBoardController` API.

## Remaining active overlap areas

1. Page-specific UI patches still active but scoped:
   - `gate-airport-phone-layout-fix.js`
   - `gate-tablet-processing-modal-fix.js`

2. Legacy base shell:
   - `public/index.html` and `gate-index-legacy-shell.css` still contain legacy CSS/markup being overridden by canonical controllers and final correction layers.

3. Input/archive metadata bridge:
   - `GateInputPageController` still helps preserve receiving-window metadata for archive payloads.

## Phase 7E conclusion

Navigation / App Shell / Mobile Shell, lifecycle hooks, Status Board metrics, Status Board dorm columns, Active Buses En Route, Processing page/modal behavior, Airport/local arrival bus workflow, Input / Week Group initialization, Archive / Reporting / Closeout, phone-only navigation artifact hiding, and page-level watermark boundaries now have active ownership separation. Additional polish should only proceed after desktop and phone validation of the 7E correction.
