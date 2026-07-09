# GATE Active Runtime Stack

Status: Phase Zero baseline
Scope: Documentation only. No runtime behavior changes.

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

Imported by `gate-utilities-access.css`:

1. `/css/gate-board-presentation.css`
2. `/css/gate-theme-unified-contract.css`
3. `/css/gate-clean-ui-pass.css`
4. `/css/gate-mobile-ui-polish.css`

Legacy / important note:

- `public/index.html` still contains substantial inline CSS and original shell layout rules.
- Some CSS is also injected dynamically by JavaScript controllers.
- The effective CSS cascade is therefore middleware CSS + imported CSS + static inline legacy CSS + script-injected style blocks.

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
19. `/js/prc-dash-access-control-validation.js`
20. `/js/prc-dash-modal-mobile-validation.js`
21. `/js/gate-tablet-processing-modal-fix.js?v=tablet-processing-modal-20260707`
22. `/js/gate-mobile-nav-routing-fix.js?v=mobile-nav-routing-20260707`
23. `/js/gate-mobile-shell-redesign.js?v=mobile-shell-redesign-20260707b`
24. `/js/gate-mobile-app-shell-finalizer.js?v=mobile-app-shell-finalizer-20260707`
25. `/js/gate-desktop-nav-restore.js?v=desktop-nav-restore-20260707`
26. `/js/gate-airport-phone-layout-fix.js?v=airport-phone-hard-fix-20260707`
27. `/js/gate-render-stability-fix.js?v=render-stability-20260707`
28. `/js/prc-dash-processing-loaded-summary.js`
29. `/js/prc-dash-current-summary-live-records.js`
30. `/js/gate-archive-print-controller.js`
31. `/js/gate-premium-metrics-controller.js?v=premium-metrics-20260709c`
32. `/js/prc-dash-overtime-audit.js`

## Runtime pattern

The current runtime is a monolithic base app with many injected compatibility and ownership layers.

`public/index.html` still contains:

- static page markup
- global state
- base data SDK adapter
- base routing and navigation
- base render loop
- base board rendering
- base Processing modal logic
- base Airport and local arrival handlers
- base Input week-group initialization
- base archive and closeout workflow
- base timer and sound logic

The injected controllers then patch, replace, wrap, or supplement the base runtime.

## High-risk active overlap areas

1. Navigation / routing
   - `index.html`
   - `prc-dash-final-audit.js`
   - `gate-access-control-controller.js`
   - `gate-mobile-nav-routing-fix.js`
   - `gate-mobile-shell-redesign.js`
   - `gate-mobile-app-shell-finalizer.js`
   - `gate-desktop-nav-restore.js`

2. Status Board metrics
   - `index.html`
   - `prc-dash-board-header.js`
   - `gate-premium-metrics-controller.js`
   - `gate-premium-metrics.css`

3. Dorm cards / board columns
   - `index.html`
   - `gate-component-contracts.js`
   - `prc-dash-final-audit.js`

4. Bus workflow
   - `index.html`
   - `gate-bus-workflow-controller.js`
   - `gate-ui-hooks.js` active bus controller

5. Input / initialization
   - `index.html`
   - `gate-input-page-controller.js`

6. Processing page / modal
   - `index.html`
   - `prc-dash-processing-context-menu.js`
   - `gate-processing-final-time-commit.js`
   - `gate-airman-modal-close-safety.js`
   - `gate-tablet-processing-modal-fix.js`
   - `prc-dash-modal-mobile-validation.js`

7. Mobile / responsive shell
   - `gate-mobile-nav-routing-fix.js`
   - `gate-mobile-shell-redesign.js`
   - `gate-mobile-app-shell-finalizer.js`
   - `gate-desktop-nav-restore.js`
   - `gate-airport-phone-layout-fix.js`
   - `prc-dash-modal-mobile-validation.js`
   - `gate-tablet-processing-modal-fix.js`

## Phase Zero conclusion

The runtime is operational but over-layered. The next development phase should not add more feature patches. It should consolidate ownership, beginning with navigation / app shell / mobile shell, then Status Board, then Processing, then Airport/Input/Archives.
