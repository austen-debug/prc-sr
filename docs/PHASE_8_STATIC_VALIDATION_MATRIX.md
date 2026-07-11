# Phase 8 — Static Workflow Validation Matrix

Status: Static validation baseline complete
Scope: Repository/runtime ownership validation after Phases 1 through 7I.

## Validation boundary

This phase validates repository structure, active middleware injection, controller ownership, retired patch removal, and static workflow wiring.

This phase does not validate live browser rendering, live D1 record writes, deployed API responses, or device-specific behavior. Those require manual browser/device testing.

## Active runtime stack validated

Middleware currently loads:

- App Shell CSS and controller
- Mobile corrective CSS
- UI ownership correction CSS
- lifecycle hooks
- Status Board controller
- Processing controller
- Bus workflow controller
- Input controller
- Archive controller
- Permission guard
- narrowed modal/touch helper
- render stability style guard
- metrics sync guard
- overtime audit

The active runtime no longer loads the retired UI/workflow patch files removed during earlier phases.

## Canonical ownership matrix

| Surface | Canonical active owner | Static status |
|---|---|---|
| App shell / routing / page state | `GateAppShell` | PASS |
| Role-aware nav | `GateAppShell` + `GatePermissionGuard` | PASS |
| Mobile sheet/menu | `GateAppShell` + UI correction CSS | PASS static / needs phone validation |
| Viewport watermark | `gate-ui-ownership-correction.css` with body route state from `GateAppShell` | PASS static / validated by user |
| Lifecycle hooks | `gate-ui-hooks.js` | PASS |
| Status Board metrics | middleware source refactor + passive metrics sync guard | PASS |
| Status Board dorm columns/cards | `GateStatusBoardController` | PASS |
| Active Buses panel | `GateStatusBoardController` | PASS |
| Active bus arrival confirmation | `GateBusWorkflowController` | PASS |
| Airport bus creation/editing | `GateBusWorkflowController` | PASS static / needs live form validation |
| Local arrival creation | `GateBusWorkflowController` | PASS static / needs live form validation |
| Processing cards/modal | `GateProcessingController` | PASS |
| Processing open/close/reopen/edit | `GateProcessingController` | PASS static / user previously confirmed most paths |
| Processing mobile modal close affordance | `gate-ui-ownership-correction.css` | PASS static / needs phone validation |
| Input batch grid / Week Group initialization | `GateInputPageController` | PASS static / needs live init validation when operationally available |
| Receiving windows | `GateInputPageController` | PASS static |
| Archive closeout / verification | `GateArchiveController` | PASS static / needs live closeout validation |
| Archive edit / print / current summary | `GateArchiveController` | PASS static / needs browser popup validation |
| Squadron Board | narrowed `prc-dash-final-audit.js` | PASS static |
| Overtime audit | `prc-dash-overtime-audit.js` | PASS static, not modified in consolidation |

## Retired active runtime files verified absent

The active middleware no longer loads:

- `prc-dash-access-control-validation.js`
- `gate-mobile-nav-routing-fix.js`
- `gate-mobile-shell-redesign.js`
- `gate-mobile-app-shell-finalizer.js`
- `gate-desktop-nav-restore.js`
- `prc-dash-processing-context-menu.js`
- `gate-processing-final-time-commit.js`
- `gate-airman-modal-close-safety.js`
- `prc-dash-archive-actions.js`
- `prc-dash-archive-print-cleanup.js`
- `prc-dash-current-summary-live-records.js`
- `gate-archive-print-controller.js`
- `prc-dash-print-report.js`
- `gate-tablet-processing-modal-fix.js`
- `gate-airport-phone-layout-fix.js`
- stray `gate-processing-modal-mobile-close.css`

## Known remaining cautions

1. `public/index.html` remains the monolithic base app and still contains legacy source functions/markup. Canonical controllers override the served runtime through middleware.
2. `GateInputPageController` still bridges some receiving-window metadata into archive/report behavior. It is currently acceptable but should eventually move into a neutral metadata utility or Archive owner.
3. Mobile Processing modal close control is static-passed but needs phone validation.
4. Live closeout cannot be fully validated until an operationally safe week group is available.
5. Archive/current summary print behavior needs browser popup validation.

## Manual validation matrix required next

### Instructor desktop

- Status Board renders metrics, active buses, dorm columns.
- Airport dispatch creates a bus.
- Active bus arrival confirmation works.
- Processing opens dorm modal.
- Right-click Processing card opens instructor actions.
- Edit dorm works.
- Reopen dorm works.
- Close dorm preserves final time.
- Input initializes a Week Group.
- Archives page renders archive cards/search.
- Current Summary print opens.

### Instructor phone

- Menu opens as a sheet.
- Status Board metrics remain readable.
- Viewport watermark stays fixed behind content.
- Airport form stacks correctly.
- Processing dorm modal opens.
- Processing modal BACK control is visible and closes modal.
- Save Load still saves and closes.

### Airman phone

- Airman role only sees allowed pages.
- Airman local arrival workflow remains available.
- Instructor-only actions remain blocked.

### Squadron desktop

- Squadron role lands on Squadron Board.
- Other operational pages are blocked.
- Squadron Board renders read-only dorm status.

## Phase 8 conclusion

Static validation passes for runtime ownership and canonical workflow wiring. Remaining work is live/manual workflow validation rather than additional patching. Do not proceed to new development until the manual validation matrix is complete or a specific blocker is reported.
