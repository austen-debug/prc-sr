# GATE Active Runtime Stack

Status: Phase 3A Status Board shadow active; CSS infrastructure consolidated; Audit Remediation Gate 1 complete  
Scope: authoritative served-runtime order from `functions/_middleware.js`

## Purpose

The active GATE application is not defined only by `public/index.html`. Cloudflare Functions middleware injects and source-refactors the CSS and JavaScript layers used by authenticated pages. This register identifies the active order, operational ownership, the narrow Phase 3A shadow boundary, and the enforced runtime-growth ceiling.

## Active asset totals

```text
Direct stylesheets: 1
Imported stylesheets: 0
Direct scripts/modules: 23
Visible Build 2 routes: 0
Hidden Build 2 runtime observers: 1
```

The machine-readable inventory and ceilings are governed by `docs/build-2/ACTIVE_RUNTIME_BUDGET.json` and validated by `tests/runtime/active-runtime-budget.test.mjs`.

## Active CSS load path

Middleware now injects one stylesheet and no stylesheet imports:

1. `/css/military-glass-terminal.css?v=military-glass-terminal-20260922-archives1`

`public/css/military-glass-terminal.css` is the production visual source of truth for tokens, light/dark themes, shell geometry, page spacing, Status/Squadron boards, Processing, Airport, Input, Archives, login, modal geometry, responsive behavior, fullscreen behavior, skeleton geometry, z-index bands, and interaction motion.

The former multi-file CSS stack and its corrective/import cascade are retired from the production filesystem. New visual changes must extend the canonical asset rather than restore a stylesheet graph or priority-lock cascade.

## Active JavaScript load path

Injected by middleware in current order:

1. `/js/gate-record-display-contract.js?v=record-display-integrity-20260714b`
2. `/js/gate-component-contracts.js`
3. `/js/gate-ui-hooks.js?v=repo-audit-20260922`
4. `/js/gate-branding-controller.js`
5. `/js/prc-dash-sat-arrivals.js`
6. `/js/gate-sound-controller.js?v=repo-audit-20260922`
7. `/js/prc-dash-final-audit.js?v=squadron-sitrep-20260922-live-sync1`
8. `/js/gate-status-board-controller.js?v=dorm-timer-record-lifecycle-20260722`
9. `/js/gate-processing-controller.js?v=repo-audit-20260922`
10. `/js/prc-dash-dorm-flag-validation.js?v=processing-band-designator-20260915`
11. `/js/prc-dash-auditorium-location.js?v=processing-modal-record-binding-20260721`
12. `/js/gate-bus-workflow-controller.js?v=repo-audit-20260922`
13. `/js/gate-airport-bus-delete-controller.js?v=repo-audit-20260922`
14. `/js/gate-input-page-controller.js?v=record-display-integrity-20260714`
15. `/js/gate-archive-controller.js?v=repo-audit-20260922`
16. `/js/gate-permission-guard.js?v=permission-server-role-20260922`
17. `/app/features/input/flight-alert-import.mjs?v=flight-alert-import-20260920`
18. `/js/gate-app-shell-controller.js?v=repo-audit-20260922`
19. `/js/gate-fullscreen-board-layout-controller.js?v=fullscreen-board-containment-20260714b`
20. `/js/prc-dash-modal-mobile-validation.js?v=phase-7e-ui-ownership-20260709`
21. `/js/gate-premium-metrics-controller.js?v=metric-live-clock-20260722`
22. `/js/prc-dash-overtime-audit.js?v=repo-audit-20260922`
23. `/js/gate-status-board-shadow-controller.js?v=phase-3a-status-board-shadow-20260715`

### Transitive module runtime

The direct middleware manifest is not the complete browser execution graph. Active module owners also load the following dependencies:

- `flight-alert-import.mjs` statically imports `week-group-action-placement.mjs`, `flight-alert-parser.mjs`, and `flight-alert-pdf.mjs`.
- `week-group-action-placement.mjs` dynamically imports `/js/gate-persistence-runtime.js`; persistence mutations remain feature-gated by the server/runtime persistence contract.
- `gate-status-board-shadow-controller.js` dynamically imports `/app/status-board-shadow/index.mjs`, which resolves the hidden Phase 3A calculation/evidence package.

These transitive dependencies are part of the runtime audit even though they do not increase the direct middleware count. Future work may narrow those import graphs, but must preserve the existing evidence and persistence boundaries.

### 22 Sep 2026 runtime consolidation

The full-repository audit removed five direct compatibility owners without removing their behavior:

- `prc-dash-space-force.js` — Space Force input/log behavior already belongs to `GateBusWorkflowController`; closed-dorm final-time normalization already belongs to `GateProcessingController`. The shared `window.allData` bridge moved into `GateHooks`, where cross-controller lifecycle infrastructure belongs.
- `gate-tablet-shell-classifier.js` — its tablet-console media query is now evaluated directly by `GateAppShell`; the global `window.matchMedia` monkey patch is retired.
- `gate-render-stability-fix.js` — the file had become a marker-only compatibility guard; all visual stability rules already live in the canonical stylesheet.
- `prc-dash-processing-loaded-summary.js` — the arrived/loaded/awaiting summary is now rendered directly by `GateProcessingController`.
- `prc-dash-runtime-fixes.js` — Processing load clamping and modal Escape behavior now live in the route owners; the canonical sound system owns sound enablement. The cross-cutting safeguard layer no longer owns unique behavior.

The direct runtime therefore moved from 28 to 23 assets and the maximum in `ACTIVE_RUNTIME_BUDGET.json` was lowered to 23 so later work cannot silently restore the removed layers.

## Operational owners

- `GateHooks` owns lifecycle hook registration and the `renderAll()` / `showPage()` wrappers. The same source file currently also contains the Port Clear feature; that mixed responsibility is documented by the repository audit and must not be mistaken for hook-only dead code.
- `GateAppShell` owns visible route state, role-aware navigation, drawer/sheet behavior, and Week Group shell context. It also owns the canonical `/board/`, `/airport/`, `/input/`, `/processing/`, `/archives/`, and instructor `/squadron-board/` browser routes, including History API Back/Forward behavior; standalone Squadron Access remains `/squadron/`.
- `GatePermissionGuard` owns client-side action protection; server authorization remains authoritative.
- `GateStatusBoardController` owns the visible Status Board dorm columns, dorm cards, active-bus panel, elapsed-time calculation, record-bound timer text, warning/critical timer state, direct-surface integrity repair, and per-column incremental rendering. It rebinds every open timer to the current dorm record before each second-aligned tick and publishes the same elapsed-time function to the Processing open/close workflow.
- `GatePremiumMetricsController` owns change-only synchronization of Arrived, Expected, Last, and Local values. The Local clock is second-aligned, displays `HH:MM:SS`, resumes immediately after visibility/focus/fullscreen transitions, and updates only the `#stat-local` text node.
- `GateProcessingController` owns Processing page rendering, the arrived/loaded/awaiting summary, dorm-modal lifecycle, final-time normalization, and all dorm-record mutations. Open writes `opened_at`; Close derives `closed_timer` from that timestamp through the canonical elapsed-time function; Reopen reconstructs `opened_at` from the retained final time.
- `GateAuditoriumLocationController` owns field hydration and card augmentation for Auditorium Location. It binds the modal field to the active dorm ID and delegates persistence through `GateProcessingController.updateDorm`; it does not call the Data SDK directly.
- `GateBusWorkflowController` owns airport and local-arrival bus workflows, including Space Force count fields and the Space Force airport-log column.
- `GateInputPageController` owns Input and Week Group initialization presentation.
- `flight-alert-import.mjs` is an active Input enhancement. It consumes the controller's public row and render interface; PDF extraction/parsing remains local and draft-oriented. Its Week Group placement dependency also boots the feature-gated persistence runtime, so that transitive dependency is explicitly tracked above rather than treated as invisible runtime.
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

The Flight Alert import is an enhancement to the existing Build 1 Input owner, not a separate visible Build 2 route. The Phase 3A observer remains the only active Build 2 shadow bridge. Build 2 shell/routes, write workflows, synchronization ownership, service worker, and fixture/evidence tooling remain staged and are not loaded as application owners by middleware.

## Runtime-bloat controls

The production CSS budget is now fixed at one direct stylesheet and zero imported stylesheets.

- A normal pull request may not add another active stylesheet or import.
- The direct script/module ceiling is 23 and may not be increased.
- Transitive module imports count as runtime dependencies for audit purposes and may not be used to bypass the direct ceiling.
- No new active asset may be named or scoped as a fix, patch, corrective layer, restore layer, finalizer, cleanup layer, or stability layer.
- Any active-asset change must update this register and `ACTIVE_RUNTIME_BUDGET.json` in the same pull request.
- Build 2 evidence, fixtures, and review tooling remain outside active middleware and routing.

## Current acceptance state

```text
PASS — one canonical production stylesheet
PASS — zero active stylesheet imports
PASS — canonical CSS contains no priority-lock declarations
PASS — active middleware order documented
PASS — direct runtime reduced from 28 to 23 scripts/modules
PASS — tablet shell logic folded into GateAppShell
PASS — Processing summary folded into GateProcessingController
PASS — Space Force compatibility duplicate retired
PASS — render-stability marker asset retired
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
PENDING — Flight Alert real-document and browser acceptance evidence
NOT AUTHORIZED — Phase 3B controlled test surface
NOT AUTHORIZED — Build 1 Status Board retirement
```

## Historical continuity

Earlier ownership consolidation, removed patch files, and page-specific migrations remain documented in the phase reports under `docs/`. Git history retains the prior expanded CSS stack. This document governs the current served runtime when those earlier reports conflict with present middleware.
