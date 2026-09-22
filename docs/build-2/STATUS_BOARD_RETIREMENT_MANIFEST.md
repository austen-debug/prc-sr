# GATE Build 2 — Status Board Retirement Manifest

Status: REQUIRED BEFORE VISIBLE PHASE 3B ACTIVATION  
Current visible owner: Build 1  
Migration route: Status Board

## Purpose

A visible Build 2 Status Board may not be added on top of the current Build 1 patch stack. The activation package must retire the competing Status Board owners and reduce the active runtime asset count.

This manifest identifies the current ownership surfaces that must be removed, absorbed, or explicitly retained as shared infrastructure.

## Active JavaScript owners

| Asset | Current responsibility | Phase 3B disposition |
|---|---|---|
| `gate-status-board-controller.js` | Visible dorm columns, dorm cards, active buses, timer text refresh | **Retire** after Build 2 route acceptance |
| `gate-premium-metrics-controller.js` | Visible Status Board metrics and Local clock | **Retire**; Build 2 route owns metric composition |
| `gate-fullscreen-board-layout-controller.js` | Fullscreen board containment and exit behavior | **Retire or reduce to shared shell primitive**; no Status Board-specific patch owner may remain |
| `prc-dash-overtime-audit.js` | Shared overtime sound-event audit and Squadron timer compatibility | Remove Status Board presentation ownership after canonical timer/audit acceptance; retain only if another route still requires shared sound/audit behavior |
| `gate-status-board-shadow-controller.js` | Hidden parity observer | **Retire after activation acceptance and final parity capture** |
| `gate-component-contracts.js` | Shared Build 1 component compatibility | Retain only if another active route still requires it; remove Status Board-specific branches |
| `gate-record-display-contract.js` | Shared canonical display ordering for legacy consumers | Retain until all dependent Build 1 routes migrate |
| `prc-dash-dorm-flag-validation.js` | Shared dorm identity/indicator validation | Retain for Processing/Squadron only if still required; remove board rendering ownership |
| `gate-ui-hooks.js` | Shared lifecycle hooks plus current Port Clear feature | Retain during strangler migration, but the Build 2 Status Board may not depend on global render wrapping |

The 22 Sep 2026 repository audit already retired `gate-status-board-timer-visual-stability.js`, `gate-render-stability-fix.js`, and `prc-dash-space-force.js`. They are historical owners, not active retirement dependencies.

## Active stylesheet owners

Production now has exactly one stylesheet authority:

| Asset | Current responsibility | Phase 3B disposition |
|---|---|---|
| `public/css/military-glass-terminal.css` | Shared tokens, themes, shell, Status/Squadron boards, route layouts, modals, responsive and fullscreen contracts | Retain as the single production stylesheet; remove or replace only the Status Board-specific selectors that become source-owned by the accepted Build 2 route |

The earlier `gate-premium-metrics.css`, `gate-fullscreen-board-contract.css`, `gate-board-presentation.css`, `gate-clean-ui-pass.css`, `gate-mobile-corrective.css`, `gate-ui-ownership-correction.css`, `gate-light-mode-grid-correction.css`, `gate-light-mode-command-contrast.css`, and `gate-tablet-shell.css` layers are no longer active production files. Historical phase reports may still name them for continuity.

## Middleware source transformations

The following middleware behavior is temporary Build 1 compatibility and must be removed from the Status Board activation package:

- `STATUS_BOARD_METRICS_HTML` source injection;
- `applyStatusBoardMetricSourceRefactor()`;
- regular-expression replacement of `updateAirportMetric()`;
- regular-expression replacement of the legacy compound arrived/expected metric writer;
- direct injection of Build 1 Status Board controllers that the accepted Build 2 route supersedes;
- Phase 3A shadow-controller injection after final acceptance.

The final Build 2 route must be served from source-owned markup and modules. Middleware may authenticate and apply stable shell assets, but it may not rewrite Status Board application functions or manufacture route markup.

## Compatibility globals to retire from Status Board ownership

- `window.GateStatusBoardController`;
- `window.GateStatusBoardShadow` after final acceptance;
- Status Board branches in `GateHooks` compatibility handoffs;
- Status Board DOM identifiers used only as compatibility sinks;
- direct reliance on global `allData`, `renderAll`, or `showPage` by the Build 2 route.

Shared globals may remain temporarily for unmigrated Build 1 routes, but the Build 2 Status Board must use the canonical store, route host, and component contracts.

## Required activation delta

The Phase 3B activation pull request must meet all of the following:

```text
Direct active stylesheets: exactly 1
Imported active stylesheets: 0
Direct active scripts/modules: 24 or fewer
New corrective/patch/fix/stability assets: 0
Middleware Status Board source rewrites: 0
Visible Status Board owners: exactly 1
Hidden shadow observer after final acceptance: 0
```

A new Build 2 route bundle may be introduced only when the total active runtime remains net-negative.

## Retirement sequence

1. Complete Issue #48 evidence and resolve arrival-time semantics.
2. Build the controlled route surface behind a default-off server-controlled activation mechanism.
3. Validate parity, all six postures, accessibility, fullscreen, stale/offline behavior, and rollback.
4. Remove middleware Status Board source rewriting.
5. Remove legacy Status Board controller and presentation assets identified above.
6. Activate the Build 2 route for the controlled test cohort.
7. Verify Build 1-only rollback by restoring the previous middleware manifest.
8. After acceptance, remove the shadow observer and close the Status Board ownership record.

## Closure evidence

The activation decision must include:

- before/after middleware asset inventories;
- proof that the one-stylesheet contract remains intact and the direct script/module count does not exceed 24;
- proof that no corrective asset was added;
- source search showing retired owner globals and middleware transformations are absent from the Status Board path;
- route-specific functional, responsive, accessibility, fullscreen, synchronization, and rollback results;
- explicit confirmation that Processing, Airport, Input, Archives, and Squadron Board owners were not unintentionally changed.
