# GATE Active Runtime Stack

Status: Phase 1A updated baseline
Scope: Documents the active served runtime after Navigation / App Shell / Mobile Shell consolidation.

## Purpose

This document identifies the active served runtime stack for GATE — Gateway Arrival Tracking Environment. The active app is not defined only by `public/index.html`; it is defined by `functions/_middleware.js`, which injects the live CSS and JavaScript layers into served HTML.

## Active CSS load path

Injected directly by middleware:

1. `/css/gate-index-legacy-shell.css`
2. `/css/gate-base-tokens.css`
3. `/css/gate-layout-pages.css`
4. `/css/gate-components.css`
5. `/css/gate-utilities-access.css`
6. `/css/gate-premium-metrics.css?v=premium-metrics-20260709c`
7. `/css/gate-app-shell.css?v=phase-1a-app-shell-20260709`

Imported by `gate-utilities-access.css`:

1. `/css/gate-board-presentation.css`
2. `/css/gate-theme-unified-contract.css`
3. `/css/gate-clean-ui-pass.css`
4. `/css/gate-mobile-ui-polish.css`

Legacy / important note:

- `public/index.html` still contains substantial inline CSS and original shell layout rules.
- Some CSS is also injected dynamically by JavaScript controllers.
- `gate-app-shell.css` is now the final active CSS owner for app shell/nav/page isolation presentation.

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
9. `/js/prc-dash-dorm-flag-validation.js`
10. `/js/prc-dash-auditorium-location.js`
11. `/js/prc-dash-processing-context-menu.js`
12. `/js/gate-processing-final-time-commit.js?v=final-time-commit-20260707`
13. `/js/gate-airman-modal-close-safety.js?v=airman-modal-close-20260707`
14. `/js/gate-bus-workflow-controller.js`
15. `/js/prc-dash-print-report.js`
16. `/js/gate-input-page-controller.js`
17. `/js/prc-dash-archive-actions.js`
18. `/js/prc-dash-archive-print-cleanup.js`
19. `/js/gate-permission-guard.js?v=phase-1a-permission-guard-20260709`
20. `/js/gate-app-shell-controller.js?v=phase-1a-app-shell-20260709`
21. `/js/prc-dash-modal-mobile-validation.js`
22. `/js/gate-tablet-processing-modal-fix.js?v=tablet-processing-modal-20260707`
23. `/js/gate-airport-phone-layout-fix.js?v=airport-phone-hard-fix-20260707`
24. `/js/gate-render-stability-fix.js?v=render-stability-20260707`
25. `/js/prc-dash-processing-loaded-summary.js`
26. `/js/prc-dash-current-summary-live-records.js`
27. `/js/gate-archive-print-controller.js`
28. `/js/gate-premium-metrics-controller.js?v=premium-metrics-20260709c`
29. `/js/prc-dash-overtime-audit.js`

## Removed from active runtime in Phase 1A

These files remain in the repository for traceability but are no longer loaded by middleware:

1. `/js/prc-dash-access-control-validation.js`
2. `/js/gate-mobile-nav-routing-fix.js?v=mobile-nav-routing-20260707`
3. `/js/gate-mobile-shell-redesign.js?v=mobile-shell-redesign-20260707b`
4. `/js/gate-mobile-app-shell-finalizer.js?v=mobile-app-shell-finalizer-20260707`
5. `/js/gate-desktop-nav-restore.js?v=desktop-nav-restore-20260707`

## Runtime pattern after Phase 1A

The runtime is still a monolithic base app plus injected controllers, but shell ownership has been consolidated.

`GateAppShell` is now the final active owner for:

- `showPage`
- `buildNav`
- role-aware nav rendering
- page isolation
- mobile drawer state
- moving system controls into/out of the mobile drawer
- Week Group chip display

`GatePermissionGuard` is now responsible for:

- protected action guards
- instructor-only form blocking
- Squadron limited interaction blocking
- Airman allowed local arrival support
- non-instructor context-menu blocking

## Remaining high-risk active overlap areas

1. Status Board metrics
   - `index.html`
   - `prc-dash-board-header.js`
   - `gate-premium-metrics-controller.js`
   - `gate-premium-metrics.css`

2. Dorm cards / board columns
   - `index.html`
   - `gate-component-contracts.js`
   - `prc-dash-final-audit.js`

3. Bus workflow
   - `index.html`
   - `gate-bus-workflow-controller.js`
   - `gate-ui-hooks.js` active bus controller

4. Input / initialization
   - `index.html`
   - `gate-input-page-controller.js`

5. Processing page / modal
   - `index.html`
   - `prc-dash-processing-context-menu.js`
   - `gate-processing-final-time-commit.js`
   - `gate-airman-modal-close-safety.js`
   - `gate-tablet-processing-modal-fix.js`
   - `prc-dash-modal-mobile-validation.js`

6. Mobile page-specific patches
   - `gate-airport-phone-layout-fix.js`
   - `prc-dash-modal-mobile-validation.js`
   - `gate-tablet-processing-modal-fix.js`

## Phase 1A conclusion

Navigation / App Shell / Mobile Shell now has a canonical active owner. The next recommended phase is Status Board metrics and board header ownership cleanup, so metric compatibility sinks and old header remnants can be removed source-first.
