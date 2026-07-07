# GATE UI Layer Catalog

This document records the active UI execution path after the Phase 14 file-audit pass. `functions/_middleware.js` remains the runtime source of truth for served UI assets.

## Active CSS middleware order

1. `/css/gate-index-legacy-shell.css`
2. `/css/gate-base-tokens.css`
3. `/css/gate-layout-pages.css`
4. `/css/gate-components.css`
5. `/css/gate-utilities-access.css`

## Final CSS import chain

`gate-utilities-access.css` loads the final visual chain:

1. `/css/gate-board-presentation.css`
2. `/css/gate-theme-unified-contract.css`
3. `/css/gate-clean-ui-pass.css`
4. `/css/gate-mobile-ui-polish.css`

`gate-mobile-ui-polish.css` is the final mobile/touch viewport override. Desktop behavior should not be changed there except where small/touch viewport selectors apply.

## Active JavaScript middleware order

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
12. `/js/gate-bus-workflow-controller.js`
13. `/js/prc-dash-print-report.js`
14. `/js/gate-input-page-controller.js`
15. `/js/prc-dash-archive-actions.js`
16. `/js/prc-dash-archive-print-cleanup.js`
17. `/js/prc-dash-access-control-validation.js`
18. `/js/prc-dash-modal-mobile-validation.js`
19. `/js/prc-dash-processing-loaded-summary.js`
20. `/js/prc-dash-current-summary-live-records.js`
21. `/js/gate-archive-print-controller.js`
22. `/js/prc-dash-overtime-audit.js`

Do not delete or rename any file in this active list during orphan cleanup.

## Runtime controller ownership

- `GateHooks` — lifecycle hook layer.
- `GateBrandingController` — visible GATE terminology and document identity.
- `GateAccessControlController` — role-aware page routing, navigation exposure, protected action guards, and future Squadron-only display support.
- `GateActiveBusController` — active bus cards on Status Board.
- `GateBusWorkflowController` — airport dispatch, local arrivals, combined bus log, shared bus edit modal, and Space Force bus counts.
- `GateInputPageController` — Input receiving windows, Space Force batch column, Band/Space Force mutual exclusion, archive receiving-window fields, and initialization preflight validation.
- `GateArchiveSchemaController` — closeout archive schema and archive-before-clear safety.
- `GateArchivePrintController` — archive print/PDF, current summary print/PDF, and archive Space Force summary UI.
- `GateDormBoardController` — Status Board dorm cards, Squadron Board runtime shell, board metrics, and close-dorm final-time safety.
- `GateTimerSoundController` — timer display, sound event processing, and overtime eligibility.
- `GateRuntimeStabilityController` — sound unlock, modal load caps, Escape-to-close, and Input batch-grid tab flow.

## Current component contracts

- Dorm Card component
- Active Bus Card component
- Status Metric component
- Archive Record component
- Header/Nav shell
- Processing Dorm Modal tagging

Dorm Card operational indicator rules:

- Female alert rings the whole dorm card.
- Band and Space Force indicators render as full-width card header banners on Status Board and Squadron Board.
- Band and Space Force indicators render as compact Processing chips.
- Space Force and Band are mutually exclusive.
- Squadron Board uses the same card structure as Status Board with limited-view data hiding.

## Phase 14 removed files

The following files were removed because they were not injected by middleware, were not imported by the active CSS chain, and were not dynamically loaded by active runtime code:

- `public/js/prc-dash-local-bus-edit.js`
- `public/js/prc-dash-receiving-windows.js`
- `public/js/prc-dash-receiving-window-fields.js`
- `public/js/prc-dash-status-header.js`
- `public/css/prc-dash-status-header.css`
- `public/css/prc-dash-board-dorms.css`

## Phase 14 intentionally retained

The following inactive file was not deleted during this pass because it appears to represent a dorm final-time correction workflow and should receive a separate behavior review before removal:

- `public/js/prc-dash-dorm-final-time.js`

Retention does not mean active runtime ownership. It means the file was not removed in this conservative pass.

## Maintenance rule

Middleware and CSS import chains are the source of truth. Before adding a new UI file, decide whether it is:

1. A canonical owner replacing older behavior, or
2. A temporary compatibility layer scheduled for removal.

Do not add broad recovery layers or repeated refresh behavior when a controller or component contract already owns the surface.
