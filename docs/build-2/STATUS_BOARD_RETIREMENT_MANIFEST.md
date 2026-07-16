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
| `gate-premium-metrics-controller.js` | Visible Status Board metrics and active-bus metric presentation | **Retire**; Build 2 route owns metric composition |
| `gate-status-board-timer-visual-stability.js` | Warning/critical class refresh | **Retire**; deterministic timer component owns state |
| `gate-fullscreen-board-layout-controller.js` | Fullscreen board containment and exit behavior | **Retire or reduce to shared shell primitive**; no Status Board-specific patch owner may remain |
| `gate-render-stability-fix.js` | Post-render stabilization including fullscreen/board behavior | **Retire** from the Status Board path |
| `prc-dash-overtime-audit.js` | Legacy overtime presentation/audit compatibility | **Retire from Status Board ownership** after canonical timer/audit acceptance |
| `gate-status-board-shadow-controller.js` | Hidden parity observer | **Retire after activation acceptance and final parity capture** |
| `gate-component-contracts.js` | Shared Build 1 component compatibility | Retain only if another active route still requires it; remove Status Board-specific branches |
| `gate-record-display-contract.js` | Shared canonical display ordering for legacy consumers | Retain until all dependent Build 1 routes migrate |
| `prc-dash-dorm-flag-validation.js` | Shared dorm identity/indicator validation | Retain for Processing/Squadron only if still required; remove board rendering ownership |
| `prc-dash-space-force.js` | Shared Space Force compatibility behavior | Retain only where another unmigrated route requires it |
| `gate-ui-hooks.js` | Legacy lifecycle hook compatibility | Retain during strangler migration, but the Build 2 Status Board may not depend on global render wrapping |

## Active stylesheet owners

| Asset | Current responsibility | Phase 3B disposition |
|---|---|---|
| `gate-premium-metrics.css` | Metrics and active-bus visual layer | **Retire** after Build 2 metric components activate |
| `gate-fullscreen-board-contract.css` | Status Board fullscreen patch layer | **Retire** after route-owned fullscreen composition activates |
| `gate-board-presentation.css` | Board/Squadron responsive presentation | Remove Status Board selectors; retain Squadron selectors only while Squadron remains Build 1 |
| `gate-clean-ui-pass.css` | Shared shell and board-card corrective ownership | Remove Status Board selectors; retain only still-owned shared/legacy selectors |
| `gate-mobile-corrective.css` | Cross-page mobile corrective layer | Build 2 Status Board may not add dependencies; board selectors must be removed |
| `gate-ui-ownership-correction.css` | Corrective ownership layer | Build 2 Status Board selectors must be removed |
| `gate-light-mode-grid-correction.css` | Light-mode grid correction | Build 2 Status Board selectors must be removed or absorbed into semantic component tokens |
| `gate-light-mode-command-contrast.css` | Command-display contrast corrections | Absorb Status Board rules into GDL semantic tokens/components |
| `gate-tablet-shell.css` | Shared legacy tablet shell | Build 2 route may consume shell contract, not page-specific patches |

## Middleware source transformations

The following middleware behavior is temporary Build 1 compatibility and must be removed from the Status Board activation package:

- `STATUS_BOARD_METRICS_HTML` source injection;
- `applyStatusBoardMetricSourceRefactor()`;
- regular-expression replacement of `updateAirportMetric()`;
- regular-expression replacement of the legacy compound arrived/expected metric writer;
- direct injection of retired Status Board controllers and stylesheets;
- Phase 3A shadow-controller injection after final acceptance.

The final Build 2 route must be served from source-owned markup and modules. Middleware may authenticate and apply stable shell assets, but it may not rewrite Status Board application functions or manufacture route markup.

## Compatibility globals to retire from Status Board ownership

- `window.GateStatusBoardController`;
- `window.GateStatusBoardTimerVisualStability`;
- `window.GateStatusBoardShadow` after final acceptance;
- Status Board branches in `GateHooks` compatibility handoffs;
- Status Board DOM identifiers used only as compatibility sinks;
- direct reliance on global `allData`, `renderAll`, or `showPage` by the Build 2 route.

Shared globals may remain temporarily for unmigrated Build 1 routes, but the Build 2 Status Board must use the canonical store, route host, and component contracts.

## Required activation delta

The Phase 3B activation pull request must meet all of the following:

```text
Direct active stylesheets: 12 or fewer
Imported active stylesheets: 3 or fewer
Direct active scripts: 24 or fewer
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
- proof that direct CSS and JavaScript counts decreased;
- proof that no corrective asset was added;
- source search showing retired owner globals and middleware transformations are absent from the Status Board path;
- route-specific functional, responsive, accessibility, fullscreen, synchronization, and rollback results;
- explicit confirmation that Processing, Airport, Input, Archives, and Squadron Board owners were not unintentionally changed.
